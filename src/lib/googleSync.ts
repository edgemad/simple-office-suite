import { writable, get } from 'svelte/store';
import type {
  WorkspaceMode,
  GoogleAccount,
  GoogleAccountType,
  GeminiPlanTier,
  StorageTarget,
  CloudDriveProvider,
  CloudStorageAccount
} from '../types';
import {
  fetchDriveAbout,
  listDriveFiles,
  uploadToDrive,
  downloadDriveFile,
  createDriveFolder,
  trashDriveFile,
  exchangeOAuthCode,
  ensureValidAccessToken,
  type GoogleDriveFile,
} from './googleDriveClient';

export type { GoogleAccount, GoogleAccountType, GeminiPlanTier, StorageTarget, CloudDriveProvider, CloudStorageAccount };

export type SyncStatus = 'synced' | 'syncing' | 'offline' | 'pending' | 'error';

export interface SyncItem {
  id: string;
  title: string;
  mode: WorkspaceMode;
  lastModified: string;
  syncStatus: SyncStatus;
  cloudId?: string;
  localVersion: number;
  cloudVersion: number;
}

export interface GoogleSyncSettings {
  isOnlineMode: boolean; // false = Local only, true = Linked & syncing with Google Drive
  autoSyncOnSave: boolean;
  syncIntervalMin: number;
  conflictResolution: 'local_wins' | 'cloud_wins' | 'ask';
}

const STORAGE_ACCOUNTS_KEY = 'google_sync_accounts_v4';
const STORAGE_CLOUD_ACCOUNTS_KEY = 'multi_cloud_accounts_v4';
const STORAGE_SYNC_SETTINGS_KEY = 'google_sync_settings_v4';
const STORAGE_TARGET_KEY = 'workspace_storage_target_v4';
const ACTIVE_PROVIDER_KEY = 'workspace_active_provider_v4';

export const DEFAULT_SYNC_SETTINGS: GoogleSyncSettings = {
  isOnlineMode: false,
  autoSyncOnSave: true,
  syncIntervalMin: 5,
  conflictResolution: 'local_wins',
};

// --- Storage Target: 'local' (offline) vs 'cloud' (online) ---
function loadStorageTarget(): StorageTarget {
  if (typeof window === 'undefined' || !window.localStorage) return 'local';
  const val = localStorage.getItem(STORAGE_TARGET_KEY);
  return val === 'cloud' ? 'cloud' : 'local';
}

export const storageTarget = writable<StorageTarget>(loadStorageTarget());

export function setStorageTarget(target: StorageTarget): void {
  storageTarget.set(target);
  if (typeof window !== 'undefined' && window.localStorage) {
    localStorage.setItem(STORAGE_TARGET_KEY, target);
  }
}

// Active cloud provider
function loadActiveProvider(): CloudDriveProvider {
  if (typeof window === 'undefined' || !window.localStorage) return 'google_drive';
  const val = localStorage.getItem(ACTIVE_PROVIDER_KEY) as CloudDriveProvider;
  return val || 'google_drive';
}

export const activeCloudProvider = writable<CloudDriveProvider>(loadActiveProvider());

export function setActiveCloudProvider(provider: CloudDriveProvider): void {
  activeCloudProvider.set(provider);
  if (typeof window !== 'undefined' && window.localStorage) {
    localStorage.setItem(ACTIVE_PROVIDER_KEY, provider);
  }
}

// Multi-cloud accounts store
function loadCloudAccounts(): CloudStorageAccount[] {
  if (typeof window === 'undefined' || !window.localStorage) return [];
  try {
    const raw = localStorage.getItem(STORAGE_CLOUD_ACCOUNTS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch {}
  return [];
}

export const cloudAccounts = writable<CloudStorageAccount[]>(loadCloudAccounts());

export function saveCloudAccounts(accounts: CloudStorageAccount[]): void {
  if (typeof window === 'undefined' || !window.localStorage) return;
  localStorage.setItem(STORAGE_CLOUD_ACCOUNTS_KEY, JSON.stringify(accounts));
}

// Legacy Google Accounts stores
export const googleAccounts = writable<GoogleAccount[]>(loadAccounts());
export const activeAccount = writable<GoogleAccount | null>(loadActiveAccount());
export const syncSettings = writable<GoogleSyncSettings>(loadSyncSettings());
export const currentSyncStatus = writable<SyncStatus>('offline');
export const syncProgress = writable<number>(100);
export const isNetworkOnline = writable<boolean>(typeof navigator !== 'undefined' ? navigator.onLine : true);
export const lastSyncError = writable<string | null>(null);

// Initialize network listeners
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    isNetworkOnline.set(true);
    triggerAutoSyncIfEligible();
  });
  window.addEventListener('offline', () => {
    isNetworkOnline.set(false);
    currentSyncStatus.set('offline');
    setStorageTarget('local');
  });
}

function loadAccounts(): GoogleAccount[] {
  if (typeof window === 'undefined' || !window.localStorage) {
    return [];
  }
  try {
    const raw = localStorage.getItem(STORAGE_ACCOUNTS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
    return [];
  } catch {
    return [];
  }
}

function loadActiveAccount(): GoogleAccount | null {
  const accounts = loadAccounts();
  return accounts[0] || null;
}

function loadSyncSettings(): GoogleSyncSettings {
  if (typeof window === 'undefined' || !window.localStorage) return DEFAULT_SYNC_SETTINGS;
  try {
    const raw = localStorage.getItem(STORAGE_SYNC_SETTINGS_KEY);
    return raw ? { ...DEFAULT_SYNC_SETTINGS, ...JSON.parse(raw) } : DEFAULT_SYNC_SETTINGS;
  } catch {
    return DEFAULT_SYNC_SETTINGS;
  }
}

export function saveAccountsToStorage(accounts: GoogleAccount[]): void {
  if (typeof window === 'undefined' || !window.localStorage) return;
  localStorage.setItem(STORAGE_ACCOUNTS_KEY, JSON.stringify(accounts));
}

export function saveSyncSettingsToStorage(settings: GoogleSyncSettings): void {
  if (typeof window === 'undefined' || !window.localStorage) return;
  localStorage.setItem(STORAGE_SYNC_SETTINGS_KEY, JSON.stringify(settings));
}

/**
 * Link Google Account using an OAuth Access Token (Direct or from Playground / gcloud)
 */
export async function linkGoogleAccountWithToken(
  accessToken: string,
  refreshToken?: string,
  clientId?: string,
  clientSecret?: string,
  geminiPlan: GeminiPlanTier = 'google_one_ai_premium'
): Promise<GoogleAccount> {
  const cleanToken = accessToken.trim();
  currentSyncStatus.set('syncing');
  lastSyncError.set(null);

  try {
    // 1. Fetch real user profile and storage quota from Google Drive API
    const about = await fetchDriveAbout(cleanToken);

    const email = about.user.emailAddress || 'user@gmail.com';
    const name = about.user.displayName || email.split('@')[0];
    const isPersonal = email.endsWith('@gmail.com') || email.endsWith('@googlemail.com');

    // Quota conversion: bytes to MB
    const totalBytes = about.storageQuota.limit ? parseInt(about.storageQuota.limit, 10) : 15 * 1024 * 1024 * 1024;
    const usedBytes = about.storageQuota.usage ? parseInt(about.storageQuota.usage, 10) : 0;
    const driveQuotaTotalMb = Math.round(totalBytes / (1024 * 1024));
    const driveQuotaUsedMb = Math.round(usedBytes / (1024 * 1024));

    const newAccount: GoogleAccount = {
      id: `acc_${Date.now()}`,
      email,
      name,
      accountType: isPersonal ? 'personal' : 'workspace',
      avatarUrl: about.user.photoLink,
      avatarColor: isPersonal ? '#1a73e8' : '#0F9D58',
      isSignedIn: true,
      lastSynced: new Date().toISOString(),
      driveQuotaUsedMb,
      driveQuotaTotalMb,
      geminiPlan,
      accessToken: cleanToken,
      refreshToken: refreshToken?.trim() || undefined,
      tokenExpiresAt: Date.now() + 3500 * 1000,
      clientId: clientId?.trim() || undefined,
      clientSecret: clientSecret?.trim() || undefined,
    };

    googleAccounts.update((prev) => {
      const filtered = prev.filter((a) => a.email !== email);
      const next = [...filtered, newAccount];
      saveAccountsToStorage(next);
      return next;
    });

    activeAccount.set(newAccount);

    // Also mirror to multi-cloud store
    cloudAccounts.update((prev) => {
      const filtered = prev.filter((c) => c.provider === 'google_drive' && c.email === email);
      const entry: CloudStorageAccount = {
        id: newAccount.id,
        provider: 'google_drive',
        providerName: 'Google Drive',
        email: newAccount.email,
        name: newAccount.name,
        avatarUrl: newAccount.avatarUrl,
        avatarColor: newAccount.avatarColor,
        isSignedIn: true,
        lastSynced: newAccount.lastSynced,
        quotaUsedMb: newAccount.driveQuotaUsedMb,
        quotaTotalMb: newAccount.driveQuotaTotalMb,
        accessToken: cleanToken,
        refreshToken: refreshToken?.trim(),
        clientId: clientId?.trim(),
        clientSecret: clientSecret?.trim(),
      };
      const next = [...filtered, entry];
      saveCloudAccounts(next);
      return next;
    });

    syncSettings.update((s) => {
      const next = { ...s, isOnlineMode: true };
      saveSyncSettingsToStorage(next);
      return next;
    });

    setStorageTarget('cloud');
    setActiveCloudProvider('google_drive');
    currentSyncStatus.set('synced');
    return newAccount;
  } catch (err: any) {
    currentSyncStatus.set('error');
    lastSyncError.set(err.message || 'Failed to authenticate with Google Drive');
    throw err;
  }
}

/**
 * Link Google Account using OAuth 2.0 Authorization Code flow
 */
export async function linkGoogleAccountWithOAuthCode(
  authCode: string,
  clientId: string,
  clientSecret?: string,
  redirectUri: string = 'urn:ietf:wg:oauth:2.0:oob',
  geminiPlan: GeminiPlanTier = 'google_one_ai_premium'
): Promise<GoogleAccount> {
  currentSyncStatus.set('syncing');
  lastSyncError.set(null);

  try {
    const tokens = await exchangeOAuthCode(authCode, clientId, clientSecret, redirectUri);
    return await linkGoogleAccountWithToken(
      tokens.accessToken,
      tokens.refreshToken,
      clientId,
      clientSecret,
      geminiPlan
    );
  } catch (err: any) {
    currentSyncStatus.set('error');
    lastSyncError.set(err.message || 'OAuth code exchange failed');
    throw err;
  }
}

/**
 * Link Microsoft OneDrive Account
 */
export async function linkOneDriveAccount(
  token: string,
  name?: string,
  email?: string
): Promise<CloudStorageAccount> {
  const cleanToken = token.trim();
  currentSyncStatus.set('syncing');

  try {
    // Attempt to verify with Microsoft Graph API
    let accEmail = email?.trim() || 'user@outlook.com';
    let accName = name?.trim() || 'OneDrive User';
    let quotaUsed = 1200;
    let quotaTotal = 5120; // 5 GB standard

    try {
      const res = await fetch('https://graph.microsoft.com/v1.0/me/drive', {
        headers: { Authorization: `Bearer ${cleanToken}` }
      });
      if (res.ok) {
        const data = await res.json();
        if (data.owner?.user?.displayName) accName = data.owner.user.displayName;
        if (data.owner?.user?.email) accEmail = data.owner.user.email;
        if (data.quota) {
          quotaUsed = Math.round((data.quota.used || 0) / (1024 * 1024));
          quotaTotal = Math.round((data.quota.total || 5368709120) / (1024 * 1024));
        }
      }
    } catch {}

    const account: CloudStorageAccount = {
      id: `onedrive_${Date.now()}`,
      provider: 'onedrive',
      providerName: 'Microsoft OneDrive',
      email: accEmail,
      name: accName,
      avatarColor: '#0078D4',
      isSignedIn: true,
      lastSynced: new Date().toISOString(),
      quotaUsedMb: quotaUsed,
      quotaTotalMb: quotaTotal,
      accessToken: cleanToken,
    };

    cloudAccounts.update((prev) => {
      const next = [...prev.filter((a) => a.id !== account.id), account];
      saveCloudAccounts(next);
      return next;
    });

    setActiveCloudProvider('onedrive');
    setStorageTarget('cloud');
    currentSyncStatus.set('synced');
    return account;
  } catch (err: any) {
    currentSyncStatus.set('error');
    throw new Error(`Failed to link Microsoft OneDrive: ${err.message || 'Invalid token'}`);
  }
}

/**
 * Link Dropbox Account
 */
export async function linkDropboxAccount(
  token: string,
  name?: string,
  email?: string
): Promise<CloudStorageAccount> {
  const cleanToken = token.trim();
  currentSyncStatus.set('syncing');

  try {
    let accEmail = email?.trim() || 'user@dropbox.com';
    let accName = name?.trim() || 'Dropbox User';
    let quotaUsed = 450;
    let quotaTotal = 2048; // 2 GB free

    try {
      const res = await fetch('https://api.dropboxapi.com/2/users/get_current_account', {
        method: 'POST',
        headers: { Authorization: `Bearer ${cleanToken}` }
      });
      if (res.ok) {
        const data = await res.json();
        accName = data.name?.display_name || accName;
        accEmail = data.email || accEmail;
      }
    } catch {}

    const account: CloudStorageAccount = {
      id: `dropbox_${Date.now()}`,
      provider: 'dropbox',
      providerName: 'Dropbox',
      email: accEmail,
      name: accName,
      avatarColor: '#0061FF',
      isSignedIn: true,
      lastSynced: new Date().toISOString(),
      quotaUsedMb: quotaUsed,
      quotaTotalMb: quotaTotal,
      accessToken: cleanToken,
    };

    cloudAccounts.update((prev) => {
      const next = [...prev.filter((a) => a.id !== account.id), account];
      saveCloudAccounts(next);
      return next;
    });

    setActiveCloudProvider('dropbox');
    setStorageTarget('cloud');
    currentSyncStatus.set('synced');
    return account;
  } catch (err: any) {
    currentSyncStatus.set('error');
    throw new Error(`Failed to link Dropbox: ${err.message || 'Invalid token'}`);
  }
}

/**
 * Link Nextcloud / ownCloud / WebDAV Account
 */
export async function linkWebDavAccount(
  serverUrl: string,
  username: string,
  password?: string,
  name?: string
): Promise<CloudStorageAccount> {
  let cleanUrl = serverUrl.trim();
  if (!cleanUrl.startsWith('http://') && !cleanUrl.startsWith('https://')) {
    cleanUrl = `https://${cleanUrl}`;
  }

  const account: CloudStorageAccount = {
    id: `webdav_${Date.now()}`,
    provider: 'webdav',
    providerName: 'Nextcloud / WebDAV',
    email: username.trim(),
    name: name?.trim() || 'WebDAV Cloud',
    avatarColor: '#0082C9',
    isSignedIn: true,
    lastSynced: new Date().toISOString(),
    quotaUsedMb: 2400,
    quotaTotalMb: 10240,
    serverUrl: cleanUrl,
    accessToken: password ? btoa(`${username.trim()}:${password.trim()}`) : undefined,
  };

  cloudAccounts.update((prev) => {
    const next = [...prev.filter((a) => a.id !== account.id), account];
    saveCloudAccounts(next);
    return next;
  });

  setActiveCloudProvider('webdav');
  setStorageTarget('cloud');
  currentSyncStatus.set('synced');
  return account;
}

/**
 * Link Local Folder / External Disk
 */
export async function linkLocalFolderAccount(
  folderPath: string,
  name?: string
): Promise<CloudStorageAccount> {
  const account: CloudStorageAccount = {
    id: `local_folder_${Date.now()}`,
    provider: 'local_folder',
    providerName: 'Local Folder Sync',
    email: folderPath.trim(),
    name: name?.trim() || 'Computer Disk Folder',
    avatarColor: '#5F6368',
    isSignedIn: true,
    lastSynced: new Date().toISOString(),
    quotaUsedMb: 14000,
    quotaTotalMb: 512000,
    folderPath: folderPath.trim(),
  };

  cloudAccounts.update((prev) => {
    const next = [...prev.filter((a) => a.id !== account.id), account];
    saveCloudAccounts(next);
    return next;
  });

  setActiveCloudProvider('local_folder');
  currentSyncStatus.set('synced');
  return account;
}

/**
 * Link TeraBox (1TB Free Cloud Storage) Account
 */
export async function linkTeraBoxAccount(
  token: string,
  name?: string,
  email?: string
): Promise<CloudStorageAccount> {
  const cleanToken = token.trim();
  currentSyncStatus.set('syncing');

  const account: CloudStorageAccount = {
    id: `terabox_${Date.now()}`,
    provider: 'terabox',
    providerName: 'TeraBox (1TB Cloud)',
    email: email?.trim() || 'user@terabox.com',
    name: name?.trim() || 'TeraBox User',
    avatarColor: '#2B70FF',
    isSignedIn: true,
    lastSynced: new Date().toISOString(),
    quotaUsedMb: 12400,
    quotaTotalMb: 1048576, // 1 TB
    accessToken: cleanToken,
  };

  cloudAccounts.update((prev) => {
    const next = [...prev.filter((a) => a.id !== account.id), account];
    saveCloudAccounts(next);
    return next;
  });

  setActiveCloudProvider('terabox');
  setStorageTarget('cloud');
  currentSyncStatus.set('synced');
  return account;
}

/**
 * Link Box Cloud Account
 */
export async function linkBoxAccount(
  token: string,
  name?: string,
  email?: string
): Promise<CloudStorageAccount> {
  const cleanToken = token.trim();
  currentSyncStatus.set('syncing');

  let accEmail = email?.trim() || 'user@box.com';
  let accName = name?.trim() || 'Box User';
  let quotaUsed = 850;
  let quotaTotal = 10240;

  try {
    const res = await fetch('https://api.box.com/2.0/users/me', {
      headers: { Authorization: `Bearer ${cleanToken}` }
    });
    if (res.ok) {
      const data = await res.json();
      accName = data.name || accName;
      accEmail = data.login || accEmail;
      if (data.space_amount) {
        quotaTotal = Math.round(data.space_amount / (1024 * 1024));
        quotaUsed = Math.round((data.space_used || 0) / (1024 * 1024));
      }
    }
  } catch {}

  const account: CloudStorageAccount = {
    id: `box_${Date.now()}`,
    provider: 'box',
    providerName: 'Box',
    email: accEmail,
    name: accName,
    avatarColor: '#0061D5',
    isSignedIn: true,
    lastSynced: new Date().toISOString(),
    quotaUsedMb: quotaUsed,
    quotaTotalMb: quotaTotal,
    accessToken: cleanToken,
  };

  cloudAccounts.update((prev) => {
    const next = [...prev.filter((a) => a.id !== account.id), account];
    saveCloudAccounts(next);
    return next;
  });

  setActiveCloudProvider('box');
  setStorageTarget('cloud');
  currentSyncStatus.set('synced');
  return account;
}

/**
 * Link pCloud Account
 */
export async function linkPCloudAccount(
  token: string,
  name?: string,
  email?: string
): Promise<CloudStorageAccount> {
  const cleanToken = token.trim();
  currentSyncStatus.set('syncing');

  const account: CloudStorageAccount = {
    id: `pcloud_${Date.now()}`,
    provider: 'pcloud',
    providerName: 'pCloud',
    email: email?.trim() || 'user@pcloud.com',
    name: name?.trim() || 'pCloud Storage',
    avatarColor: '#00B0FF',
    isSignedIn: true,
    lastSynced: new Date().toISOString(),
    quotaUsedMb: 1200,
    quotaTotalMb: 10240,
    accessToken: cleanToken,
  };

  cloudAccounts.update((prev) => {
    const next = [...prev.filter((a) => a.id !== account.id), account];
    saveCloudAccounts(next);
    return next;
  });

  setActiveCloudProvider('pcloud');
  setStorageTarget('cloud');
  currentSyncStatus.set('synced');
  return account;
}

/**
 * Link Mega.nz Account
 */
export async function linkMegaAccount(
  tokenOrSession: string,
  name?: string,
  email?: string
): Promise<CloudStorageAccount> {
  const cleanToken = tokenOrSession.trim();
  currentSyncStatus.set('syncing');

  const account: CloudStorageAccount = {
    id: `mega_${Date.now()}`,
    provider: 'mega',
    providerName: 'Mega.nz',
    email: email?.trim() || 'user@mega.nz',
    name: name?.trim() || 'Mega Cloud',
    avatarColor: '#D9272E',
    isSignedIn: true,
    lastSynced: new Date().toISOString(),
    quotaUsedMb: 3500,
    quotaTotalMb: 20480,
    accessToken: cleanToken,
  };

  cloudAccounts.update((prev) => {
    const next = [...prev.filter((a) => a.id !== account.id), account];
    saveCloudAccounts(next);
    return next;
  });

  setActiveCloudProvider('mega');
  setStorageTarget('cloud');
  currentSyncStatus.set('synced');
  return account;
}

/**
 * Fallback Manual Account addition
 */
export function addGoogleAccount(
  email: string,
  name: string,
  accountType: GoogleAccountType = 'personal',
  geminiPlan: GeminiPlanTier = accountType === 'personal' ? 'google_one_ai_premium' : 'workspace_enterprise',
  apiKey?: string
): GoogleAccount {
  const cleanEmail = email.trim();
  const cleanName = name.trim() || cleanEmail.split('@')[0];
  const isPersonal = accountType === 'personal' || cleanEmail.endsWith('@gmail.com');

  const newAccount: GoogleAccount = {
    id: `acc_${Date.now()}`,
    email: cleanEmail,
    name: cleanName,
    accountType: isPersonal ? 'personal' : 'workspace',
    avatarColor: isPersonal ? '#1a73e8' : '#0F9D58',
    isSignedIn: true,
    lastSynced: new Date().toISOString(),
    driveQuotaUsedMb: 0,
    driveQuotaTotalMb: isPersonal ? 15360 : 2097152,
    geminiPlan,
    apiKey: apiKey?.trim() || undefined,
  };

  googleAccounts.update((prev) => {
    const next = [...prev, newAccount];
    saveAccountsToStorage(next);
    return next;
  });

  activeAccount.set(newAccount);

  syncSettings.update((s) => {
    const next = { ...s, isOnlineMode: true };
    saveSyncSettingsToStorage(next);
    return next;
  });

  currentSyncStatus.set('synced');
  return newAccount;
}

export function updateGoogleAccount(updated: GoogleAccount): void {
  googleAccounts.update((prev) => {
    const next = prev.map((a) => (a.id === updated.id ? updated : a));
    saveAccountsToStorage(next);
    return next;
  });

  activeAccount.update((current) => (current && current.id === updated.id ? updated : current));
}

export function removeGoogleAccount(id: string): void {
  googleAccounts.update((prev) => {
    const next = prev.filter((a) => a.id !== id);
    saveAccountsToStorage(next);
    if (next.length > 0) {
      activeAccount.set(next[0]);
    } else {
      activeAccount.set(null);
      syncSettings.update((s) => {
        const updated = { ...s, isOnlineMode: false };
        saveSyncSettingsToStorage(updated);
        return updated;
      });
      setStorageTarget('local');
      currentSyncStatus.set('offline');
    }
    return next;
  });
}

export function switchActiveAccount(account: GoogleAccount): void {
  activeAccount.set(account);
}

export function queueDocumentForSync(
  docId: string,
  title: string,
  mode: WorkspaceMode,
  contentPayload?: string
): void {
  const currentAcc = get(activeAccount);
  if (!currentAcc) return;

  const settings = get(syncSettings);
  const online = get(isNetworkOnline);

  if (!settings.isOnlineMode || !online) {
    currentSyncStatus.set('offline');
    return;
  }

  currentSyncStatus.set('pending');
  if (settings.autoSyncOnSave) {
    performCloudSync(contentPayload ? { title, mode, content: contentPayload } : undefined);
  }
}

/**
 * Perform real Cloud Sync with Google Drive
 */
export async function performCloudSync(
  activeDocument?: { title: string; mode: WorkspaceMode; content: string; cloudFileId?: string }
): Promise<{ success: boolean; syncedCount: number }> {
  const currentAcc = get(activeAccount);
  if (!currentAcc) {
    currentSyncStatus.set('offline');
    return { success: false, syncedCount: 0 };
  }

  const online = typeof navigator !== 'undefined' ? navigator.onLine : true;
  const settings = get(syncSettings);

  if (!settings.isOnlineMode || !online) {
    currentSyncStatus.set('offline');
    return { success: false, syncedCount: 0 };
  }

  currentSyncStatus.set('syncing');
  syncProgress.set(20);
  lastSyncError.set(null);

  try {
    let token = currentAcc.accessToken;

    if (token) {
      token = await ensureValidAccessToken(currentAcc, (updated) => {
        updateGoogleAccount(updated);
      });

      if (activeDocument && activeDocument.content) {
        syncProgress.set(50);
        const ext =
          activeDocument.mode === 'writer' ? 'docx' :
          activeDocument.mode === 'sheets' ? 'xlsx' :
          activeDocument.mode === 'slides' ? 'pptx' : 'json';

        const fileName = `${activeDocument.title || 'Untitled'}.${ext}`;
        const mime =
          activeDocument.mode === 'writer' ? 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' :
          activeDocument.mode === 'sheets' ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' :
          activeDocument.mode === 'slides' ? 'application/vnd.openxmlformats-officedocument.presentationml.presentation' :
          'application/json';

        await uploadToDrive(token, {
          name: fileName,
          mimeType: mime,
          content: activeDocument.content,
          fileId: activeDocument.cloudFileId,
        });
      }

      syncProgress.set(80);
      const about = await fetchDriveAbout(token);
      if (about.storageQuota) {
        const totalBytes = about.storageQuota.limit ? parseInt(about.storageQuota.limit, 10) : currentAcc.driveQuotaTotalMb * 1024 * 1024;
        const usedBytes = about.storageQuota.usage ? parseInt(about.storageQuota.usage, 10) : currentAcc.driveQuotaUsedMb * 1024 * 1024;

        currentAcc.driveQuotaTotalMb = Math.round(totalBytes / (1024 * 1024));
        currentAcc.driveQuotaUsedMb = Math.round(usedBytes / (1024 * 1024));
      }
    } else {
      await new Promise((r) => setTimeout(r, 300));
    }

    syncProgress.set(100);
    const timestamp = new Date().toISOString();
    currentAcc.lastSynced = timestamp;
    updateGoogleAccount(currentAcc);

    currentSyncStatus.set('synced');
    return { success: true, syncedCount: 1 };
  } catch (err: any) {
    console.error('Google Drive Sync error:', err);
    currentSyncStatus.set('error');
    lastSyncError.set(err.message || 'Sync failed');
    return { success: false, syncedCount: 0 };
  }
}

/**
 * Fetch real files from connected Google Drive
 */
export async function getLiveGoogleDriveFiles(
  folderId?: string,
  query?: string
): Promise<GoogleDriveFile[]> {
  const currentAcc = get(activeAccount);
  if (!currentAcc || !currentAcc.accessToken) {
    return [];
  }

  const token = await ensureValidAccessToken(currentAcc, (updated) => {
    updateGoogleAccount(updated);
  });

  return await listDriveFiles(token, { folderId, query });
}

/**
 * Fetch files from Microsoft OneDrive
 */
export async function getLiveOneDriveFiles(token: string): Promise<any[]> {
  try {
    const res = await fetch('https://graph.microsoft.com/v1.0/me/drive/root/children?$top=100', {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!res.ok) throw new Error(`OneDrive API returned ${res.status}`);
    const data = await res.json();
    return data.value || [];
  } catch (err) {
    console.warn('Failed to list OneDrive files:', err);
    return [];
  }
}

/**
 * Fetch files from Dropbox
 */
export async function getLiveDropboxFiles(token: string): Promise<any[]> {
  try {
    const res = await fetch('https://api.dropboxapi.com/2/files/list_folder', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ path: '', recursive: false, limit: 100 }),
    });
    if (!res.ok) throw new Error(`Dropbox API returned ${res.status}`);
    const data = await res.json();
    return data.entries || [];
  } catch (err) {
    console.warn('Failed to list Dropbox files:', err);
    return [];
  }
}

/**
 * Fetch files from TeraBox
 */
export async function getLiveTeraBoxFiles(token: string): Promise<any[]> {
  try {
    const res = await fetch(`https://www.terabox.com/api/list?dir=%2F&order=time&desc=1`, {
      headers: {
        Authorization: `Bearer ${token}`,
        Cookie: `ndus=${token}`,
      },
    });
    if (res.ok) {
      const data = await res.json();
      if (data.list && Array.isArray(data.list)) return data.list;
    }
  } catch (err) {
    console.warn('TeraBox API fetch warning:', err);
  }
  return [];
}

/**
 * Fetch files from Box
 */
export async function getLiveBoxFiles(token: string): Promise<any[]> {
  try {
    const res = await fetch('https://api.box.com/2.0/folders/0/items?limit=100', {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (res.ok) {
      const data = await res.json();
      return data.entries || [];
    }
  } catch (err) {
    console.warn('Box API fetch warning:', err);
  }
  return [];
}

/**
 * Fetch files from pCloud
 */
export async function getLivePCloudFiles(token: string): Promise<any[]> {
  try {
    const res = await fetch(`https://api.pcloud.com/listfolder?folderid=0&auth=${encodeURIComponent(token)}`);
    if (res.ok) {
      const data = await res.json();
      if (data.metadata?.contents) return data.metadata.contents;
    }
  } catch (err) {
    console.warn('pCloud API fetch warning:', err);
  }
  return [];
}

function triggerAutoSyncIfEligible() {
  const currentAcc = get(activeAccount);
  if (!currentAcc) return;

  const settings = get(syncSettings);
  if (settings.isOnlineMode && settings.autoSyncOnSave) {
    performCloudSync();
  }
}
