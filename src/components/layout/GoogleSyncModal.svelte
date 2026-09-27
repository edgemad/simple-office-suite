<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import {
    X,
    RefreshCw,
    Cloud,
    CloudOff,
    Check,
    Plus,
    Trash2,
    HardDrive,
    ShieldCheck,
    User,
    Building2,
    CheckCircle2,
    Sliders,
    Sparkles,
    KeyRound,
    ExternalLink,
    AlertCircle,
    Copy,
    Lock,
    Globe,
    ClipboardPaste,
    FolderSync,
    Server,
    Laptop,
    Database,
    Zap
  } from 'lucide-svelte';
  import {
    googleAccounts,
    activeAccount,
    cloudAccounts,
    storageTarget,
    setStorageTarget,
    activeCloudProvider,
    setActiveCloudProvider,
    syncSettings,
    currentSyncStatus,
    syncProgress,
    isNetworkOnline,
    lastSyncError,
    linkGoogleAccountWithToken,
    linkGoogleAccountWithOAuthCode,
    linkOneDriveAccount,
    linkDropboxAccount,
    linkTeraBoxAccount,
    linkBoxAccount,
    linkPCloudAccount,
    linkMegaAccount,
    linkWebDavAccount,
    linkLocalFolderAccount,
    addGoogleAccount,
    removeGoogleAccount,
    switchActiveAccount,
    performCloudSync,
    saveSyncSettingsToStorage
  } from '../../lib/googleSync';
  import { buildGoogleOAuthUrl } from '../../lib/googleDriveClient';
  import { openUrlInBrowserNative, listenForOAuthCallbackNative } from '../../lib/tauri';
  import type { GoogleAccount, GoogleAccountType, GeminiPlanTier, CloudDriveProvider, StorageTarget } from '../../types';

  const dispatch = createEventDispatcher<{
    close: void;
  }>();

  let isSyncing = false;
  let showAddAccount = false;
  let selectedProvider: CloudDriveProvider = 'google_drive';
  let isAuthorizing = false;
  let authErrorMessage = '';
  let browserNotice = '';

  // Google inputs
  let inputAccessToken = '';
  let inputRefreshToken = '';
  let inputClientId = '';
  let inputClientSecret = '';
  let inputAuthCode = '';
  let isListeningLoopback = false;

  // TeraBox inputs
  let teraboxToken = '';
  let teraboxEmail = '';
  let teraboxName = '';

  // OneDrive inputs
  let oneDriveToken = '';
  let oneDriveEmail = '';
  let oneDriveName = '';

  // Dropbox inputs
  let dropboxToken = '';
  let dropboxEmail = '';
  let dropboxName = '';

  // Box inputs
  let boxToken = '';
  let boxEmail = '';
  let boxName = '';

  // pCloud inputs
  let pcloudToken = '';
  let pcloudEmail = '';
  let pcloudName = '';

  // Mega inputs
  let megaToken = '';
  let megaEmail = '';
  let megaName = '';

  // WebDAV inputs
  let webDavUrl = '';
  let webDavUser = '';
  let webDavPass = '';
  let webDavName = '';

  // Local folder inputs
  let localFolderPath = '/Volumes/1TBex/SimpleOfficeDocuments';
  let localFolderName = 'Main Document Vault';

  let syncSuccessMsg = '';

  $: accounts = $googleAccounts;
  $: cAccounts = $cloudAccounts;
  $: currentAcc = $activeAccount;
  $: settings = $syncSettings;
  $: status = $currentSyncStatus;
  $: online = $isNetworkOnline;
  $: error = $lastSyncError;
  $: currentStorage = $storageTarget;

  $: if (accounts.length === 0 && cAccounts.length === 0 && !showAddAccount) {
    showAddAccount = true;
  }

  async function handleOpenBrowser(url: string, notice: string) {
    authErrorMessage = '';
    browserNotice = notice;
    try {
      await openUrlInBrowserNative(url);
    } catch (err: any) {
      console.warn('Failed to open URL in browser:', err);
    }
  }

  async function handlePasteAndConnect(targetProvider: CloudDriveProvider) {
    authErrorMessage = '';
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard) {
        const text = await navigator.clipboard.readText();
        const cleaned = text.trim();
        if (cleaned) {
          if (targetProvider === 'google_drive') {
            inputAccessToken = cleaned;
            await handleConnectGoogle();
          } else if (targetProvider === 'terabox') {
            teraboxToken = cleaned;
            await handleConnectTeraBox();
          } else if (targetProvider === 'onedrive') {
            oneDriveToken = cleaned;
            await handleConnectOneDrive();
          } else if (targetProvider === 'dropbox') {
            dropboxToken = cleaned;
            await handleConnectDropbox();
          } else if (targetProvider === 'box') {
            boxToken = cleaned;
            await handleConnectBox();
          } else if (targetProvider === 'pcloud') {
            pcloudToken = cleaned;
            await handleConnectPCloud();
          } else if (targetProvider === 'mega') {
            megaToken = cleaned;
            await handleConnectMega();
          }
          return;
        }
      }
      authErrorMessage = 'Clipboard is empty. Please copy your access token or session key first.';
    } catch (err: any) {
      authErrorMessage = 'Could not access clipboard: ' + (err.message || 'permission denied');
    }
  }

  // --- Google Connect ---
  async function handleOpenGoogleLoginWeb() {
    const playgroundUrl =
      'https://developers.google.com/oauthplayground/#step1&apisSelect=' +
      encodeURIComponent(
        'https://www.googleapis.com/auth/drive,https://www.googleapis.com/auth/drive.readonly,https://www.googleapis.com/auth/drive.file,https://www.googleapis.com/auth/userinfo.email,https://www.googleapis.com/auth/userinfo.profile'
      );
    await handleOpenBrowser(
      playgroundUrl,
      'Web browser opened to Google OAuth Playground. Select Drive API v3 (https://www.googleapis.com/auth/drive), click Authorize, exchange tokens, copy the Access Token, and click Paste from Clipboard & Connect.'
    );
  }

  async function handleConnectGoogle() {
    if (!inputAccessToken.trim()) {
      await handleOpenGoogleLoginWeb();
      authErrorMessage = 'Web browser opened. Complete authorization, copy your token, and click Paste from Clipboard & Connect.';
      return;
    }
    isAuthorizing = true;
    authErrorMessage = '';
    try {
      await linkGoogleAccountWithToken(
        inputAccessToken.trim(),
        inputRefreshToken.trim() || undefined,
        inputClientId.trim() || undefined,
        inputClientSecret.trim() || undefined
      );
      inputAccessToken = '';
      inputRefreshToken = '';
      showAddAccount = false;
      syncSuccessMsg = 'Connected to Google Drive successfully!';
      setTimeout(() => (syncSuccessMsg = ''), 4000);
    } catch (err: any) {
      authErrorMessage = err.message || 'Failed to authenticate with Google Drive API.';
    } finally {
      isAuthorizing = false;
    }
  }

  // --- TeraBox Connect ---
  async function handleOpenTeraBoxLogin() {
    await handleOpenBrowser(
      'https://www.terabox.com/web/login',
      'Web browser opened to TeraBox Web Login. Sign in to your account, copy your session token or cookie (ndus), and click Paste from Clipboard & Connect.'
    );
  }

  async function handleConnectTeraBox() {
    if (!teraboxToken.trim()) {
      await handleOpenTeraBoxLogin();
      authErrorMessage = 'Web browser opened. Sign in to TeraBox, copy your session token, and click Paste from Clipboard & Connect.';
      return;
    }
    isAuthorizing = true;
    authErrorMessage = '';
    try {
      await linkTeraBoxAccount(teraboxToken.trim(), teraboxName.trim() || undefined, teraboxEmail.trim() || undefined);
      teraboxToken = '';
      showAddAccount = false;
      syncSuccessMsg = 'TeraBox (1TB Cloud) linked successfully!';
      setTimeout(() => (syncSuccessMsg = ''), 4000);
    } catch (err: any) {
      authErrorMessage = err.message || 'Failed to link TeraBox.';
    } finally {
      isAuthorizing = false;
    }
  }

  // --- OneDrive Connect ---
  async function handleOpenOneDriveLogin() {
    await handleOpenBrowser(
      'https://developer.microsoft.com/en-us/graph/graph-explorer',
      'Web browser opened to Microsoft Graph Explorer. Sign in with your Microsoft account, select the "Access token" tab, copy the token, and click Paste from Clipboard & Connect.'
    );
  }

  async function handleConnectOneDrive() {
    if (!oneDriveToken.trim()) {
      await handleOpenOneDriveLogin();
      authErrorMessage = 'Web browser opened. Sign in to Microsoft Graph, copy your token, and click Paste from Clipboard & Connect.';
      return;
    }
    isAuthorizing = true;
    authErrorMessage = '';
    try {
      await linkOneDriveAccount(oneDriveToken.trim(), oneDriveName.trim() || undefined, oneDriveEmail.trim() || undefined);
      oneDriveToken = '';
      showAddAccount = false;
      syncSuccessMsg = 'Microsoft OneDrive linked successfully!';
      setTimeout(() => (syncSuccessMsg = ''), 4000);
    } catch (err: any) {
      authErrorMessage = err.message || 'Failed to link OneDrive.';
    } finally {
      isAuthorizing = false;
    }
  }

  // --- Dropbox Connect ---
  async function handleOpenDropboxLogin() {
    await handleOpenBrowser(
      'https://www.dropbox.com/developers/apps',
      'Web browser opened to Dropbox Developer Apps. Create an app or click your app, click "Generate access token", copy it, and click Paste from Clipboard & Connect.'
    );
  }

  async function handleConnectDropbox() {
    if (!dropboxToken.trim()) {
      await handleOpenDropboxLogin();
      authErrorMessage = 'Web browser opened. Generate a Dropbox access token, copy it, and click Paste from Clipboard & Connect.';
      return;
    }
    isAuthorizing = true;
    authErrorMessage = '';
    try {
      await linkDropboxAccount(dropboxToken.trim(), dropboxName.trim() || undefined, dropboxEmail.trim() || undefined);
      dropboxToken = '';
      showAddAccount = false;
      syncSuccessMsg = 'Dropbox linked successfully!';
      setTimeout(() => (syncSuccessMsg = ''), 4000);
    } catch (err: any) {
      authErrorMessage = err.message || 'Failed to link Dropbox.';
    } finally {
      isAuthorizing = false;
    }
  }

  // --- Box Connect ---
  async function handleOpenBoxLogin() {
    await handleOpenBrowser(
      'https://app.box.com/developers/console',
      'Web browser opened to Box Developer Console. Generate a developer token, copy it, and click Paste from Clipboard & Connect.'
    );
  }

  async function handleConnectBox() {
    if (!boxToken.trim()) {
      await handleOpenBoxLogin();
      authErrorMessage = 'Web browser opened. Copy your Box developer token and click Paste from Clipboard & Connect.';
      return;
    }
    isAuthorizing = true;
    authErrorMessage = '';
    try {
      await linkBoxAccount(boxToken.trim(), boxName.trim() || undefined, boxEmail.trim() || undefined);
      boxToken = '';
      showAddAccount = false;
      syncSuccessMsg = 'Box Cloud Storage linked successfully!';
      setTimeout(() => (syncSuccessMsg = ''), 4000);
    } catch (err: any) {
      authErrorMessage = err.message || 'Failed to link Box.';
    } finally {
      isAuthorizing = false;
    }
  }

  // --- pCloud Connect ---
  async function handleOpenPCloudLogin() {
    await handleOpenBrowser(
      'https://my.pcloud.com/',
      'Web browser opened to pCloud. Sign in and generate an access token, then click Paste from Clipboard & Connect.'
    );
  }

  async function handleConnectPCloud() {
    if (!pcloudToken.trim()) {
      await handleOpenPCloudLogin();
      authErrorMessage = 'Web browser opened. Copy your pCloud token and click Paste from Clipboard & Connect.';
      return;
    }
    isAuthorizing = true;
    authErrorMessage = '';
    try {
      await linkPCloudAccount(pcloudToken.trim(), pcloudName.trim() || undefined, pcloudEmail.trim() || undefined);
      pcloudToken = '';
      showAddAccount = false;
      syncSuccessMsg = 'pCloud linked successfully!';
      setTimeout(() => (syncSuccessMsg = ''), 4000);
    } catch (err: any) {
      authErrorMessage = err.message || 'Failed to link pCloud.';
    } finally {
      isAuthorizing = false;
    }
  }

  // --- Mega Connect ---
  async function handleOpenMegaLogin() {
    await handleOpenBrowser(
      'https://mega.io/login',
      'Web browser opened to Mega.nz. Sign in, copy your API session token, and click Paste from Clipboard & Connect.'
    );
  }

  async function handleConnectMega() {
    if (!megaToken.trim()) {
      await handleOpenMegaLogin();
      authErrorMessage = 'Web browser opened. Copy your Mega session token and click Paste from Clipboard & Connect.';
      return;
    }
    isAuthorizing = true;
    authErrorMessage = '';
    try {
      await linkMegaAccount(megaToken.trim(), megaName.trim() || undefined, megaEmail.trim() || undefined);
      megaToken = '';
      showAddAccount = false;
      syncSuccessMsg = 'Mega.nz linked successfully!';
      setTimeout(() => (syncSuccessMsg = ''), 4000);
    } catch (err: any) {
      authErrorMessage = err.message || 'Failed to link Mega.';
    } finally {
      isAuthorizing = false;
    }
  }

  // --- WebDAV Connect ---
  async function handleOpenWebDavLogin() {
    const url = webDavUrl.trim() || 'https://nextcloud.com';
    await handleOpenBrowser(
      url,
      'Web browser opened to your cloud server. Log in, go to Personal Settings -> Security -> App passwords to create a token, then copy it.'
    );
  }

  async function handleConnectWebDav() {
    if (!webDavUrl.trim() || !webDavUser.trim()) {
      authErrorMessage = 'Please enter your WebDAV server URL and username.';
      return;
    }
    isAuthorizing = true;
    authErrorMessage = '';
    try {
      await linkWebDavAccount(webDavUrl.trim(), webDavUser.trim(), webDavPass.trim() || undefined, webDavName.trim() || undefined);
      showAddAccount = false;
      syncSuccessMsg = 'Nextcloud / WebDAV linked successfully!';
      setTimeout(() => (syncSuccessMsg = ''), 4000);
    } catch (err: any) {
      authErrorMessage = err.message || 'Failed to connect WebDAV.';
    } finally {
      isAuthorizing = false;
    }
  }

  // --- Local Folder Connect ---
  async function handleConnectLocalFolder() {
    if (!localFolderPath.trim()) {
      authErrorMessage = 'Please specify a valid folder path on your computer.';
      return;
    }
    isAuthorizing = true;
    authErrorMessage = '';
    try {
      await linkLocalFolderAccount(localFolderPath.trim(), localFolderName.trim() || undefined);
      showAddAccount = false;
      syncSuccessMsg = 'Local Folder linked as primary workspace!';
      setTimeout(() => (syncSuccessMsg = ''), 4000);
    } catch (err: any) {
      authErrorMessage = err.message || 'Failed to link folder.';
    } finally {
      isAuthorizing = false;
    }
  }

  async function handleManualSync() {
    if (!currentAcc) return;
    isSyncing = true;
    syncSuccessMsg = '';
    authErrorMessage = '';
    const res = await performCloudSync();
    isSyncing = false;
    if (res.success) {
      syncSuccessMsg = `Successfully synced with Google Drive!`;
      setTimeout(() => (syncSuccessMsg = ''), 4000);
    }
  }

  function toggleStorageTarget(target: StorageTarget) {
    setStorageTarget(target);
    if (target === 'cloud' && currentAcc) {
      settings.isOnlineMode = true;
      saveSyncSettingsToStorage(settings);
      handleManualSync();
    }
  }
</script>

<div class="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 select-none animate-in fade-in duration-150">
  <div class="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-3xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-150 text-slate-800">
    <!-- Header -->
    <div class="px-6 pt-5 pb-3 flex items-center justify-between border-b border-slate-100">
      <div class="flex items-center space-x-2.5">
        <div class="w-9 h-9 rounded-2xl bg-gradient-to-tr from-blue-500 to-indigo-600 flex items-center justify-center text-white shadow-xs">
          <Cloud size={20} />
        </div>
        <div>
          <h2 class="text-base font-semibold text-slate-900 leading-tight">Storage & Cloud Drive Synchronization</h2>
          <span class="text-xs text-slate-500 font-medium">Link Google Drive, TeraBox, OneDrive, Dropbox, Box, pCloud, Mega or WebDAV</span>
        </div>
      </div>
      <button
        class="p-1.5 rounded-full hover:bg-slate-100 text-slate-500 hover:text-slate-800 transition-colors"
        on:click={() => dispatch('close')}
        aria-label="Close"
      >
        <X size={18} />
      </button>
    </div>

    <!-- Body -->
    <div class="p-6 space-y-5 text-xs max-h-[75vh] overflow-y-auto">
      <!-- Storage Mode Selector (Local vs Cloud) -->
      <div class="p-4 bg-slate-50 rounded-2xl border border-slate-200 flex items-center justify-between">
        <div>
          <span class="font-semibold text-slate-900 block text-xs">Primary Storage Location</span>
          <span class="text-[11px] text-slate-500">
            {currentStorage === 'local'
              ? 'Local Storage active — documents are saved on your computer (100% offline, zero cloud required).'
              : 'Cloud Drive active — documents are synchronized with your connected online cloud storage.'}
          </span>
        </div>
        <div class="flex items-center bg-white p-1 rounded-xl border border-slate-200 text-xs font-semibold shadow-2xs">
          <button
            type="button"
            class="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg transition-all {currentStorage === 'local' ? 'bg-blue-600 text-white shadow-2xs' : 'text-slate-600 hover:text-slate-900'}"
            on:click={() => toggleStorageTarget('local')}
          >
            <HardDrive size={13} />
            <span>Local Storage</span>
          </button>
          <button
            type="button"
            class="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg transition-all {currentStorage === 'cloud' ? 'bg-blue-600 text-white shadow-2xs' : 'text-slate-600 hover:text-slate-900'}"
            on:click={() => toggleStorageTarget('cloud')}
          >
            <Cloud size={13} />
            <span>Cloud Drive</span>
          </button>
        </div>
      </div>

      <!-- Sync Status Banner -->
      <div class="p-4 rounded-2xl border flex items-center justify-between {currentAcc?.accessToken && currentStorage === 'cloud' && online ? 'bg-emerald-50/70 border-emerald-200' : 'bg-slate-50 border-slate-200'}">
        <div class="flex items-center space-x-3">
          <div class="w-10 h-10 rounded-full flex items-center justify-center {currentAcc?.accessToken && currentStorage === 'cloud' && online ? 'bg-emerald-600 text-white' : 'bg-slate-300 text-slate-700'}">
            {#if isSyncing}
              <RefreshCw size={18} class="animate-spin" />
            {:else if currentAcc?.accessToken && currentStorage === 'cloud' && online}
              <Cloud size={18} />
            {:else}
              <HardDrive size={18} />
            {/if}
          </div>
          <div>
            <div class="flex items-center space-x-2">
              <span class="font-semibold text-sm text-slate-900">
                {#if currentStorage === 'local'}
                  Local On-Device Storage (Offline Ready)
                {:else if isSyncing}
                  Syncing with Cloud Drive API...
                {:else if !currentAcc && cAccounts.length === 0}
                  No Cloud Drive Linked
                {:else if !online}
                  Network Offline (Using Local Storage)
                {:else}
                  Live Cloud Sync Connected
                {/if}
              </span>
              <span class="px-2 py-0.5 rounded-full text-[10px] font-semibold {currentStorage === 'cloud' && (currentAcc?.accessToken || cAccounts.length > 0) && online ? 'bg-emerald-100 text-emerald-800' : 'bg-blue-100 text-blue-800'}">
                {currentStorage === 'cloud' && (currentAcc?.accessToken || cAccounts.length > 0) && online ? 'Connected & Live' : 'Offline / Local'}
              </span>
            </div>
            <span class="text-[11px] text-slate-500 block mt-0.5">
              {#if currentStorage === 'local'}
                All documents are saved locally in on-device storage. No internet required.
              {:else if currentAcc}
                Linked: <strong class="text-slate-700">{currentAcc.email}</strong> • Quota: {(currentAcc.driveQuotaUsedMb / 1024).toFixed(2)} GB used of {(currentAcc.driveQuotaTotalMb / 1024).toFixed(1)} GB
              {:else if cAccounts.length > 0}
                Linked: <strong class="text-slate-700">{cAccounts[0].email}</strong> ({cAccounts[0].providerName})
              {:else}
                Choose a cloud provider below to link your online storage.
              {/if}
            </span>
          </div>
        </div>

        {#if currentAcc && currentStorage === 'cloud'}
          <button
            class="flex items-center space-x-1.5 px-4 py-2 rounded-xl font-semibold text-xs transition-all shadow-xs {isSyncing ? 'bg-slate-200 text-slate-400' : 'bg-blue-600 hover:bg-blue-700 text-white'}"
            on:click={handleManualSync}
            disabled={isSyncing}
          >
            <RefreshCw size={13} class={isSyncing ? 'animate-spin' : ''} />
            <span>{isSyncing ? 'Syncing...' : 'Sync Now'}</span>
          </button>
        {/if}
      </div>

      {#if syncSuccessMsg}
        <div class="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs flex items-center space-x-2 animate-in fade-in">
          <CheckCircle2 size={15} class="text-emerald-600 shrink-0" />
          <span>{syncSuccessMsg}</span>
        </div>
      {/if}

      {#if browserNotice}
        <div class="p-3 bg-blue-50 border border-blue-200 text-blue-900 rounded-xl text-xs flex items-start space-x-2 animate-in fade-in">
          <Globe size={15} class="text-blue-600 shrink-0 mt-0.5" />
          <span class="leading-relaxed">{browserNotice}</span>
        </div>
      {/if}

      {#if error || authErrorMessage}
        <div class="p-3.5 bg-rose-50 border border-rose-200 text-rose-800 rounded-2xl text-xs flex items-start space-x-2.5 animate-in fade-in">
          <AlertCircle size={16} class="text-rose-600 shrink-0 mt-0.5" />
          <div class="space-y-1.5 flex-1">
            <span class="font-semibold block">Notice:</span>
            <span class="block text-slate-700 leading-relaxed">{error || authErrorMessage}</span>
          </div>
        </div>
      {/if}

      <!-- Online Drive Provider Tabs -->
      <div>
        <div class="flex items-center justify-between mb-2">
          <span class="font-semibold text-slate-800">
            Link Online Cloud Drive
          </span>
          <button
            class="flex items-center space-x-1 text-blue-600 hover:text-blue-700 font-semibold"
            on:click={() => (showAddAccount = !showAddAccount)}
          >
            <Plus size={13} />
            <span>{showAddAccount ? 'Close' : 'Add / Switch Provider'}</span>
          </button>
        </div>

        {#if showAddAccount || (accounts.length === 0 && cAccounts.length === 0)}
          <div class="p-5 bg-gradient-to-br from-blue-50/80 to-indigo-50/80 border border-blue-200 rounded-3xl space-y-4 mb-3 animate-in fade-in">
            <!-- Provider Selector Tabs (Horizontal Scrollable) -->
            <div class="flex items-center justify-between border-b border-blue-200/80 pb-3 gap-2">
              <span class="font-semibold text-blue-950 text-xs shrink-0">Drive Provider:</span>
              <div class="flex bg-white/90 p-0.5 rounded-xl border border-blue-200 text-[11px] overflow-x-auto gap-1">
                <button
                  type="button"
                  class="px-2.5 py-1.5 rounded-lg font-semibold transition-all shrink-0 {selectedProvider === 'google_drive' ? 'bg-blue-600 text-white shadow-2xs' : 'text-slate-600 hover:text-slate-900'}"
                  on:click={() => (selectedProvider = 'google_drive')}
                >
                  📁 Google Drive
                </button>
                <button
                  type="button"
                  class="px-2.5 py-1.5 rounded-lg font-semibold transition-all shrink-0 {selectedProvider === 'terabox' ? 'bg-blue-600 text-white shadow-2xs' : 'text-slate-600 hover:text-slate-900'}"
                  on:click={() => (selectedProvider = 'terabox')}
                >
                  📦 TeraBox (1TB)
                </button>
                <button
                  type="button"
                  class="px-2.5 py-1.5 rounded-lg font-semibold transition-all shrink-0 {selectedProvider === 'onedrive' ? 'bg-blue-600 text-white shadow-2xs' : 'text-slate-600 hover:text-slate-900'}"
                  on:click={() => (selectedProvider = 'onedrive')}
                >
                  🟦 OneDrive
                </button>
                <button
                  type="button"
                  class="px-2.5 py-1.5 rounded-lg font-semibold transition-all shrink-0 {selectedProvider === 'dropbox' ? 'bg-blue-600 text-white shadow-2xs' : 'text-slate-600 hover:text-slate-900'}"
                  on:click={() => (selectedProvider = 'dropbox')}
                >
                  📦 Dropbox
                </button>
                <button
                  type="button"
                  class="px-2.5 py-1.5 rounded-lg font-semibold transition-all shrink-0 {selectedProvider === 'box' ? 'bg-blue-600 text-white shadow-2xs' : 'text-slate-600 hover:text-slate-900'}"
                  on:click={() => (selectedProvider = 'box')}
                >
                  💼 Box
                </button>
                <button
                  type="button"
                  class="px-2.5 py-1.5 rounded-lg font-semibold transition-all shrink-0 {selectedProvider === 'pcloud' ? 'bg-blue-600 text-white shadow-2xs' : 'text-slate-600 hover:text-slate-900'}"
                  on:click={() => (selectedProvider = 'pcloud')}
                >
                  ☁️ pCloud
                </button>
                <button
                  type="button"
                  class="px-2.5 py-1.5 rounded-lg font-semibold transition-all shrink-0 {selectedProvider === 'mega' ? 'bg-blue-600 text-white shadow-2xs' : 'text-slate-600 hover:text-slate-900'}"
                  on:click={() => (selectedProvider = 'mega')}
                >
                  🔴 Mega.nz
                </button>
                <button
                  type="button"
                  class="px-2.5 py-1.5 rounded-lg font-semibold transition-all shrink-0 {selectedProvider === 'webdav' ? 'bg-blue-600 text-white shadow-2xs' : 'text-slate-600 hover:text-slate-900'}"
                  on:click={() => (selectedProvider = 'webdav')}
                >
                  🌐 WebDAV
                </button>
                <button
                  type="button"
                  class="px-2.5 py-1.5 rounded-lg font-semibold transition-all shrink-0 {selectedProvider === 'local_folder' ? 'bg-blue-600 text-white shadow-2xs' : 'text-slate-600 hover:text-slate-900'}"
                  on:click={() => (selectedProvider = 'local_folder')}
                >
                  🗄️ Computer Folder
                </button>
              </div>
            </div>

            <!-- Provider 1: Google Drive -->
            {#if selectedProvider === 'google_drive'}
              <div class="bg-white p-4 rounded-2xl border border-blue-200 shadow-2xs space-y-3">
                <div class="flex items-center justify-between">
                  <div class="flex items-center space-x-2">
                    <Globe size={18} class="text-blue-600" />
                    <span class="font-semibold text-slate-900 text-xs">Google Drive (Personal or Workspace)</span>
                  </div>
                  <span class="text-[10px] bg-blue-100 text-blue-800 font-semibold px-2 py-0.5 rounded-full">15 GB+ Free</span>
                </div>

                <p class="text-[11px] text-slate-600 leading-relaxed">
                  Open Google Sign-In in your web browser to authorize access to your Google Drive files.
                </p>

                <div class="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                  <button
                    type="button"
                    class="py-2.5 px-3.5 bg-white hover:bg-slate-50 text-slate-800 font-semibold text-xs rounded-xl border border-slate-300 shadow-2xs flex items-center justify-center space-x-2 transition-all hover:border-slate-400 active:scale-[0.99]"
                    on:click={handleOpenGoogleLoginWeb}
                  >
                    <Globe size={14} class="text-blue-600 shrink-0" />
                    <span class="truncate">Open in Browser to Log In</span>
                    <ExternalLink size={13} class="text-slate-400 shrink-0" />
                  </button>

                  <button
                    type="button"
                    class="py-2.5 px-3.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs rounded-xl shadow-xs flex items-center justify-center space-x-1.5 transition-all active:scale-[0.99]"
                    on:click={() => handlePasteAndConnect('google_drive')}
                    disabled={isAuthorizing}
                  >
                    {#if isAuthorizing}
                      <RefreshCw size={13} class="animate-spin" />
                      <span>Verifying...</span>
                    {:else}
                      <ClipboardPaste size={14} />
                      <span>Paste from Clipboard & Connect</span>
                    {/if}
                  </button>
                </div>

                <!-- Scope Tip -->
                <div class="bg-amber-50/90 border border-amber-200 p-2.5 rounded-xl text-[11px] text-amber-900 space-y-1">
                  <span class="font-semibold block">⚠️ Scope Tip for Google Playground:</span>
                  <span>
                    In Step 1 on Playground, check <strong>Google Drive API v3 -> <code class="bg-white/80 px-1 py-0.5 rounded font-mono">https://www.googleapis.com/auth/drive</code></strong>. If you only select <code class="bg-white/80 px-1 py-0.5 rounded font-mono">drive.file</code>, Google hides your existing files!
                  </span>
                </div>

                <div class="pt-1">
                  <label for="google-token-input" class="block text-[11px] text-slate-700 font-medium mb-1">
                    Or paste Google Access Token manually:
                  </label>
                  <div class="flex space-x-2">
                    <input
                      id="google-token-input"
                      type="text"
                      placeholder="ya29.a0AfH6SM..."
                      bind:value={inputAccessToken}
                      class="flex-1 bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs text-slate-900 outline-none focus:border-blue-500 font-mono"
                    />
                    <button
                      type="button"
                      class="px-4 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs shadow-2xs flex items-center space-x-1.5 shrink-0"
                      on:click={handleConnectGoogle}
                      disabled={isAuthorizing}
                    >
                      <Check size={13} />
                      <span>Connect</span>
                    </button>
                  </div>
                </div>
              </div>
            {/if}

            <!-- Provider 2: TeraBox (1TB Free) -->
            {#if selectedProvider === 'terabox'}
              <div class="bg-white p-4 rounded-2xl border border-blue-200 shadow-2xs space-y-3">
                <div class="flex items-center justify-between">
                  <div class="flex items-center space-x-2">
                    <Zap size={18} class="text-[#2B70FF]" />
                    <span class="font-semibold text-slate-900 text-xs">TeraBox Cloud (1024 GB / 1 TB Free Storage)</span>
                  </div>
                  <span class="text-[10px] bg-emerald-100 text-emerald-800 font-semibold px-2 py-0.5 rounded-full">1024 GB Free</span>
                </div>

                <p class="text-[11px] text-slate-600 leading-relaxed">
                  Log in to your TeraBox account in your browser, copy your session token or cookie (<code class="bg-slate-100 px-1 py-0.5 rounded font-mono">ndus</code>), and link it here for 1 TB of cloud storage.
                </p>

                <div class="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                  <button
                    type="button"
                    class="py-2.5 px-3.5 bg-white hover:bg-slate-50 text-slate-800 font-semibold text-xs rounded-xl border border-slate-300 shadow-2xs flex items-center justify-center space-x-2 transition-all hover:border-slate-400 active:scale-[0.99]"
                    on:click={handleOpenTeraBoxLogin}
                  >
                    <Globe size={14} class="text-[#2B70FF] shrink-0" />
                    <span class="truncate">Open in Browser to Log In</span>
                    <ExternalLink size={13} class="text-slate-400 shrink-0" />
                  </button>

                  <button
                    type="button"
                    class="py-2.5 px-3.5 bg-[#2B70FF] hover:bg-blue-700 text-white font-semibold text-xs rounded-xl shadow-xs flex items-center justify-center space-x-1.5 transition-all active:scale-[0.99]"
                    on:click={() => handlePasteAndConnect('terabox')}
                    disabled={isAuthorizing}
                  >
                    <ClipboardPaste size={14} />
                    <span>Paste from Clipboard & Connect</span>
                  </button>
                </div>

                <div class="grid grid-cols-2 gap-2 pt-1">
                  <div>
                    <label for="terabox-name" class="block text-[11px] text-slate-700 font-medium mb-1">Display Name</label>
                    <input
                      id="terabox-name"
                      type="text"
                      placeholder="My TeraBox"
                      bind:value={teraboxName}
                      class="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs text-slate-900 outline-none focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label for="terabox-email" class="block text-[11px] text-slate-700 font-medium mb-1">TeraBox Email / User</label>
                    <input
                      id="terabox-email"
                      type="email"
                      placeholder="user@terabox.com"
                      bind:value={teraboxEmail}
                      class="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs text-slate-900 outline-none focus:border-blue-500"
                    />
                  </div>
                </div>

                <div>
                  <label for="terabox-token" class="block text-[11px] text-slate-700 font-medium mb-1">
                    TeraBox Session Token or Cookie (ndus)
                  </label>
                  <div class="flex space-x-2">
                    <input
                      id="terabox-token"
                      type="password"
                      placeholder="ndus=... or API token"
                      bind:value={teraboxToken}
                      class="flex-1 bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs text-slate-900 outline-none focus:border-blue-500 font-mono"
                    />
                    <button
                      type="button"
                      class="px-4 py-1.5 bg-[#2B70FF] hover:bg-blue-700 text-white font-semibold rounded-lg text-xs shadow-xs flex items-center space-x-1.5 shrink-0"
                      on:click={handleConnectTeraBox}
                      disabled={isAuthorizing}
                    >
                      <Check size={13} />
                      <span>Link TeraBox</span>
                    </button>
                  </div>
                </div>
              </div>
            {/if}

            <!-- Provider 3: Microsoft OneDrive -->
            {#if selectedProvider === 'onedrive'}
              <div class="bg-white p-4 rounded-2xl border border-blue-200 shadow-2xs space-y-3">
                <div class="flex items-center justify-between">
                  <div class="flex items-center space-x-2">
                    <span class="text-base">🟦</span>
                    <span class="font-semibold text-slate-900 text-xs">Microsoft OneDrive & SharePoint</span>
                  </div>
                  <span class="text-[10px] bg-blue-100 text-blue-800 font-semibold px-2 py-0.5 rounded-full">Microsoft 365</span>
                </div>

                <p class="text-[11px] text-slate-600 leading-relaxed">
                  Open Microsoft Graph Explorer in your browser to sign in with your personal Microsoft or work/school account, copy the Access Token, and link it here.
                </p>

                <div class="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                  <button
                    type="button"
                    class="py-2.5 px-3.5 bg-white hover:bg-slate-50 text-slate-800 font-semibold text-xs rounded-xl border border-slate-300 shadow-2xs flex items-center justify-center space-x-2 transition-all hover:border-slate-400 active:scale-[0.99]"
                    on:click={handleOpenOneDriveLogin}
                  >
                    <Globe size={14} class="text-[#0078D4] shrink-0" />
                    <span class="truncate">Open in Browser to Log In</span>
                    <ExternalLink size={13} class="text-slate-400 shrink-0" />
                  </button>

                  <button
                    type="button"
                    class="py-2.5 px-3.5 bg-[#0078D4] hover:bg-[#006cbd] text-white font-semibold text-xs rounded-xl shadow-xs flex items-center justify-center space-x-1.5 transition-all active:scale-[0.99]"
                    on:click={() => handlePasteAndConnect('onedrive')}
                    disabled={isAuthorizing}
                  >
                    <ClipboardPaste size={14} />
                    <span>Paste from Clipboard & Connect</span>
                  </button>
                </div>

                <div class="grid grid-cols-2 gap-2 pt-1">
                  <div>
                    <label for="onedrive-name" class="block text-[11px] text-slate-700 font-medium mb-1">Account Name</label>
                    <input
                      id="onedrive-name"
                      type="text"
                      placeholder="Work OneDrive"
                      bind:value={oneDriveName}
                      class="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs text-slate-900 outline-none focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label for="onedrive-email" class="block text-[11px] text-slate-700 font-medium mb-1">Account Email</label>
                    <input
                      id="onedrive-email"
                      type="email"
                      placeholder="user@outlook.com"
                      bind:value={oneDriveEmail}
                      class="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs text-slate-900 outline-none focus:border-blue-500"
                    />
                  </div>
                </div>

                <div>
                  <label for="onedrive-token" class="block text-[11px] text-slate-700 font-medium mb-1">
                    Microsoft Graph Bearer Token
                  </label>
                  <div class="flex space-x-2">
                    <input
                      id="onedrive-token"
                      type="password"
                      placeholder="EwB... (Graph API token)"
                      bind:value={oneDriveToken}
                      class="flex-1 bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs text-slate-900 outline-none focus:border-blue-500 font-mono"
                    />
                    <button
                      type="button"
                      class="px-4 py-1.5 bg-[#0078D4] hover:bg-[#006cbd] text-white font-semibold rounded-lg text-xs shadow-xs flex items-center space-x-1.5 shrink-0"
                      on:click={handleConnectOneDrive}
                      disabled={isAuthorizing}
                    >
                      <Check size={13} />
                      <span>Link OneDrive</span>
                    </button>
                  </div>
                </div>
              </div>
            {/if}

            <!-- Provider 4: Dropbox -->
            {#if selectedProvider === 'dropbox'}
              <div class="bg-white p-4 rounded-2xl border border-blue-200 shadow-2xs space-y-3">
                <div class="flex items-center justify-between">
                  <div class="flex items-center space-x-2">
                    <span class="text-base">📦</span>
                    <span class="font-semibold text-slate-900 text-xs">Dropbox Cloud Storage</span>
                  </div>
                  <span class="text-[10px] bg-blue-100 text-blue-800 font-semibold px-2 py-0.5 rounded-full">Dropbox API</span>
                </div>

                <p class="text-[11px] text-slate-600 leading-relaxed">
                  Open the Dropbox Developer Console in your browser, generate an Access Token, copy it, and link it here.
                </p>

                <div class="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                  <button
                    type="button"
                    class="py-2.5 px-3.5 bg-white hover:bg-slate-50 text-slate-800 font-semibold text-xs rounded-xl border border-slate-300 shadow-2xs flex items-center justify-center space-x-2 transition-all hover:border-slate-400 active:scale-[0.99]"
                    on:click={handleOpenDropboxLogin}
                  >
                    <Globe size={14} class="text-[#0061FF] shrink-0" />
                    <span class="truncate">Open in Browser to Log In</span>
                    <ExternalLink size={13} class="text-slate-400 shrink-0" />
                  </button>

                  <button
                    type="button"
                    class="py-2.5 px-3.5 bg-[#0061FF] hover:bg-[#0052d9] text-white font-semibold text-xs rounded-xl shadow-xs flex items-center justify-center space-x-1.5 transition-all active:scale-[0.99]"
                    on:click={() => handlePasteAndConnect('dropbox')}
                    disabled={isAuthorizing}
                  >
                    <ClipboardPaste size={14} />
                    <span>Paste from Clipboard & Connect</span>
                  </button>
                </div>

                <div class="grid grid-cols-2 gap-2 pt-1">
                  <div>
                    <label for="dropbox-name" class="block text-[11px] text-slate-700 font-medium mb-1">Display Name</label>
                    <input
                      id="dropbox-name"
                      type="text"
                      placeholder="My Dropbox"
                      bind:value={dropboxName}
                      class="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs text-slate-900 outline-none focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label for="dropbox-email" class="block text-[11px] text-slate-700 font-medium mb-1">Dropbox Email</label>
                    <input
                      id="dropbox-email"
                      type="email"
                      placeholder="user@dropbox.com"
                      bind:value={dropboxEmail}
                      class="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs text-slate-900 outline-none focus:border-blue-500"
                    />
                  </div>
                </div>

                <div>
                  <label for="dropbox-token" class="block text-[11px] text-slate-700 font-medium mb-1">
                    Dropbox Access Token (sl.u.A...)
                  </label>
                  <div class="flex space-x-2">
                    <input
                      id="dropbox-token"
                      type="password"
                      placeholder="sl.u.A..."
                      bind:value={dropboxToken}
                      class="flex-1 bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs text-slate-900 outline-none focus:border-blue-500 font-mono"
                    />
                    <button
                      type="button"
                      class="px-4 py-1.5 bg-[#0061FF] hover:bg-[#0052d9] text-white font-semibold rounded-lg text-xs shadow-xs flex items-center space-x-1.5 shrink-0"
                      on:click={handleConnectDropbox}
                      disabled={isAuthorizing}
                    >
                      <Check size={13} />
                      <span>Link Dropbox</span>
                    </button>
                  </div>
                </div>
              </div>
            {/if}

            <!-- Provider 5: Box -->
            {#if selectedProvider === 'box'}
              <div class="bg-white p-4 rounded-2xl border border-blue-200 shadow-2xs space-y-3">
                <div class="flex items-center justify-between">
                  <div class="flex items-center space-x-2">
                    <span class="text-base">💼</span>
                    <span class="font-semibold text-slate-900 text-xs">Box Cloud Storage</span>
                  </div>
                  <span class="text-[10px] bg-blue-100 text-blue-800 font-semibold px-2 py-0.5 rounded-full">Box.com</span>
                </div>

                <p class="text-[11px] text-slate-600 leading-relaxed">
                  Open the Box Developer Console in your browser to generate a developer token, copy it, and link it here.
                </p>

                <div class="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                  <button
                    type="button"
                    class="py-2.5 px-3.5 bg-white hover:bg-slate-50 text-slate-800 font-semibold text-xs rounded-xl border border-slate-300 shadow-2xs flex items-center justify-center space-x-2 transition-all hover:border-slate-400 active:scale-[0.99]"
                    on:click={handleOpenBoxLogin}
                  >
                    <Globe size={14} class="text-[#0061D5] shrink-0" />
                    <span class="truncate">Open in Browser to Log In</span>
                    <ExternalLink size={13} class="text-slate-400 shrink-0" />
                  </button>

                  <button
                    type="button"
                    class="py-2.5 px-3.5 bg-[#0061D5] hover:bg-blue-700 text-white font-semibold text-xs rounded-xl shadow-xs flex items-center justify-center space-x-1.5 transition-all active:scale-[0.99]"
                    on:click={() => handlePasteAndConnect('box')}
                    disabled={isAuthorizing}
                  >
                    <ClipboardPaste size={14} />
                    <span>Paste from Clipboard & Connect</span>
                  </button>
                </div>

                <div>
                  <label for="box-token" class="block text-[11px] text-slate-700 font-medium mb-1">
                    Box Developer Token
                  </label>
                  <div class="flex space-x-2">
                    <input
                      id="box-token"
                      type="password"
                      placeholder="Paste Box token..."
                      bind:value={boxToken}
                      class="flex-1 bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs text-slate-900 outline-none focus:border-blue-500 font-mono"
                    />
                    <button
                      type="button"
                      class="px-4 py-1.5 bg-[#0061D5] hover:bg-blue-700 text-white font-semibold rounded-lg text-xs shadow-xs flex items-center space-x-1.5 shrink-0"
                      on:click={handleConnectBox}
                      disabled={isAuthorizing}
                    >
                      <Check size={13} />
                      <span>Link Box</span>
                    </button>
                  </div>
                </div>
              </div>
            {/if}

            <!-- Provider 6: pCloud -->
            {#if selectedProvider === 'pcloud'}
              <div class="bg-white p-4 rounded-2xl border border-blue-200 shadow-2xs space-y-3">
                <div class="flex items-center justify-between">
                  <div class="flex items-center space-x-2">
                    <span class="text-base">☁️</span>
                    <span class="font-semibold text-slate-900 text-xs">pCloud Storage</span>
                  </div>
                  <span class="text-[10px] bg-blue-100 text-blue-800 font-semibold px-2 py-0.5 rounded-full">10 GB Free</span>
                </div>

                <p class="text-[11px] text-slate-600 leading-relaxed">
                  Open pCloud in your browser to sign in, copy your API access token, and link your files.
                </p>

                <div class="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                  <button
                    type="button"
                    class="py-2.5 px-3.5 bg-white hover:bg-slate-50 text-slate-800 font-semibold text-xs rounded-xl border border-slate-300 shadow-2xs flex items-center justify-center space-x-2 transition-all hover:border-slate-400 active:scale-[0.99]"
                    on:click={handleOpenPCloudLogin}
                  >
                    <Globe size={14} class="text-[#00B0FF] shrink-0" />
                    <span class="truncate">Open in Browser to Log In</span>
                    <ExternalLink size={13} class="text-slate-400 shrink-0" />
                  </button>

                  <button
                    type="button"
                    class="py-2.5 px-3.5 bg-[#00B0FF] hover:bg-sky-600 text-white font-semibold text-xs rounded-xl shadow-xs flex items-center justify-center space-x-1.5 transition-all active:scale-[0.99]"
                    on:click={() => handlePasteAndConnect('pcloud')}
                    disabled={isAuthorizing}
                  >
                    <ClipboardPaste size={14} />
                    <span>Paste from Clipboard & Connect</span>
                  </button>
                </div>

                <div>
                  <label for="pcloud-token" class="block text-[11px] text-slate-700 font-medium mb-1">
                    pCloud OAuth Access Token
                  </label>
                  <div class="flex space-x-2">
                    <input
                      id="pcloud-token"
                      type="password"
                      placeholder="Paste pCloud token..."
                      bind:value={pcloudToken}
                      class="flex-1 bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs text-slate-900 outline-none focus:border-blue-500 font-mono"
                    />
                    <button
                      type="button"
                      class="px-4 py-1.5 bg-[#00B0FF] hover:bg-sky-600 text-white font-semibold rounded-lg text-xs shadow-xs flex items-center space-x-1.5 shrink-0"
                      on:click={handleConnectPCloud}
                      disabled={isAuthorizing}
                    >
                      <Check size={13} />
                      <span>Link pCloud</span>
                    </button>
                  </div>
                </div>
              </div>
            {/if}

            <!-- Provider 7: Mega.nz -->
            {#if selectedProvider === 'mega'}
              <div class="bg-white p-4 rounded-2xl border border-blue-200 shadow-2xs space-y-3">
                <div class="flex items-center justify-between">
                  <div class="flex items-center space-x-2">
                    <span class="text-base">🔴</span>
                    <span class="font-semibold text-slate-900 text-xs">Mega.nz Cloud (20 GB Free)</span>
                  </div>
                  <span class="text-[10px] bg-rose-100 text-rose-800 font-semibold px-2 py-0.5 rounded-full">Encrypted</span>
                </div>

                <p class="text-[11px] text-slate-600 leading-relaxed">
                  Open Mega.nz in your browser to sign in, copy your API session token, and link your files.
                </p>

                <div class="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                  <button
                    type="button"
                    class="py-2.5 px-3.5 bg-white hover:bg-slate-50 text-slate-800 font-semibold text-xs rounded-xl border border-slate-300 shadow-2xs flex items-center justify-center space-x-2 transition-all hover:border-slate-400 active:scale-[0.99]"
                    on:click={handleOpenMegaLogin}
                  >
                    <Globe size={14} class="text-[#D9272E] shrink-0" />
                    <span class="truncate">Open in Browser to Log In</span>
                    <ExternalLink size={13} class="text-slate-400 shrink-0" />
                  </button>

                  <button
                    type="button"
                    class="py-2.5 px-3.5 bg-[#D9272E] hover:bg-rose-700 text-white font-semibold text-xs rounded-xl shadow-xs flex items-center justify-center space-x-1.5 transition-all active:scale-[0.99]"
                    on:click={() => handlePasteAndConnect('mega')}
                    disabled={isAuthorizing}
                  >
                    <ClipboardPaste size={14} />
                    <span>Paste from Clipboard & Connect</span>
                  </button>
                </div>

                <div>
                  <label for="mega-token" class="block text-[11px] text-slate-700 font-medium mb-1">
                    Mega Session Token / Key
                  </label>
                  <div class="flex space-x-2">
                    <input
                      id="mega-token"
                      type="password"
                      placeholder="Paste Mega token..."
                      bind:value={megaToken}
                      class="flex-1 bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs text-slate-900 outline-none focus:border-blue-500 font-mono"
                    />
                    <button
                      type="button"
                      class="px-4 py-1.5 bg-[#D9272E] hover:bg-rose-700 text-white font-semibold rounded-lg text-xs shadow-xs flex items-center space-x-1.5 shrink-0"
                      on:click={handleConnectMega}
                      disabled={isAuthorizing}
                    >
                      <Check size={13} />
                      <span>Link Mega</span>
                    </button>
                  </div>
                </div>
              </div>
            {/if}

            <!-- Provider 8: Nextcloud / WebDAV -->
            {#if selectedProvider === 'webdav'}
              <div class="bg-white p-4 rounded-2xl border border-blue-200 shadow-2xs space-y-3">
                <div class="flex items-center justify-between">
                  <div class="flex items-center space-x-2">
                    <Server size={16} class="text-[#0082C9]" />
                    <span class="font-semibold text-slate-900 text-xs">Nextcloud / ownCloud / WebDAV</span>
                  </div>
                  <span class="text-[10px] bg-blue-100 text-blue-800 font-semibold px-2 py-0.5 rounded-full">Self-Hosted</span>
                </div>

                <p class="text-[11px] text-slate-600 leading-relaxed">
                  Connect to any private or self-hosted cloud server supporting the open WebDAV protocol.
                </p>

                <div class="flex space-x-2">
                  <button
                    type="button"
                    class="py-2 px-3 bg-white hover:bg-slate-50 text-slate-800 font-semibold text-xs rounded-xl border border-slate-300 shadow-2xs flex items-center space-x-1.5"
                    on:click={handleOpenWebDavLogin}
                  >
                    <Globe size={13} class="text-[#0082C9]" />
                    <span>Open Server in Browser</span>
                    <ExternalLink size={12} class="text-slate-400" />
                  </button>
                </div>

                <div>
                  <label for="webdav-url" class="block text-[11px] text-slate-700 font-medium mb-1">WebDAV Endpoint URL</label>
                  <input
                    id="webdav-url"
                    type="url"
                    placeholder="https://cloud.example.com/remote.php/webdav"
                    bind:value={webDavUrl}
                    class="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs text-slate-900 outline-none focus:border-blue-500 font-mono"
                  />
                </div>

                <div class="grid grid-cols-2 gap-2">
                  <div>
                    <label for="webdav-user" class="block text-[11px] text-slate-700 font-medium mb-1">Username</label>
                    <input
                      id="webdav-user"
                      type="text"
                      placeholder="Username"
                      bind:value={webDavUser}
                      class="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs text-slate-900 outline-none focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label for="webdav-pass" class="block text-[11px] text-slate-700 font-medium mb-1">App Password / Token</label>
                    <input
                      id="webdav-pass"
                      type="password"
                      placeholder="App Password"
                      bind:value={webDavPass}
                      class="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs text-slate-900 outline-none focus:border-blue-500 font-mono"
                    />
                  </div>
                </div>

                <div class="flex justify-end pt-1">
                  <button
                    type="button"
                    class="px-4 py-2 bg-[#0082C9] hover:bg-[#0070ad] text-white font-semibold rounded-xl text-xs shadow-xs flex items-center space-x-1.5"
                    on:click={handleConnectWebDav}
                    disabled={isAuthorizing}
                  >
                    <Check size={14} />
                    <span>Link WebDAV Server</span>
                  </button>
                </div>
              </div>
            {/if}

            <!-- Provider 9: Local Folder Sync -->
            {#if selectedProvider === 'local_folder'}
              <div class="bg-white p-4 rounded-2xl border border-blue-200 shadow-2xs space-y-3">
                <div class="flex items-center space-x-2">
                  <HardDrive size={16} class="text-slate-700" />
                  <span class="font-semibold text-slate-900 text-xs">Computer Disk / External Drive Folder</span>
                </div>
                <p class="text-[11px] text-slate-600 leading-relaxed">
                  Designate any directory on your computer or external drive (e.g. USB flash drive, SD card) as a synchronized document vault.
                </p>

                <div>
                  <label for="local-folder-path" class="block text-[11px] text-slate-700 font-medium mb-1">Folder Path</label>
                  <input
                    id="local-folder-path"
                    type="text"
                    placeholder="/Volumes/1TBex/SimpleOfficeDocuments"
                    bind:value={localFolderPath}
                    class="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs text-slate-900 outline-none focus:border-blue-500 font-mono"
                  />
                </div>

                <div class="flex justify-end pt-1">
                  <button
                    type="button"
                    class="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white font-semibold rounded-xl text-xs shadow-xs flex items-center space-x-1.5"
                    on:click={handleConnectLocalFolder}
                    disabled={isAuthorizing}
                  >
                    <Check size={14} />
                    <span>Link Folder</span>
                  </button>
                </div>
              </div>
            {/if}
          </div>
        {/if}

        <!-- Connected Accounts List -->
        {#if accounts.length > 0 || cAccounts.length > 0}
          <div class="space-y-2">
            <!-- Google Accounts -->
            {#each accounts as acc}
              {@const isActive = currentAcc && acc.id === currentAcc.id}
              {@const isLive = !!acc.accessToken}
              <!-- svelte-ignore a11y_click_events_have_key_events -->
              <!-- svelte-ignore a11y_no_static_element_interactions -->
              <div
                class="flex items-center justify-between p-3.5 rounded-2xl border transition-all cursor-pointer {isActive ? 'bg-blue-50/40 border-blue-500/80 shadow-xs' : 'bg-white border-slate-200 hover:border-slate-300'}"
                on:click={() => switchActiveAccount(acc)}
              >
                <div class="flex items-center space-x-3">
                  <div
                    class="w-9 h-9 rounded-full text-white font-bold flex items-center justify-center text-sm shadow-xs shrink-0"
                    style="background-color: {acc.avatarColor};"
                  >
                    G
                  </div>
                  <div>
                    <div class="flex items-center space-x-2">
                      <span class="font-semibold text-slate-900 text-xs">{acc.name}</span>
                      <span class="px-1.5 py-0.2 rounded text-[9px] font-bold uppercase tracking-wider {isLive ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'}">
                        {isLive ? 'Google Drive Live' : 'Offline'}
                      </span>
                      {#if isActive}
                        <span class="px-1.5 py-0.2 bg-blue-100 text-blue-800 rounded text-[9px] font-bold">ACTIVE</span>
                      {/if}
                    </div>
                    <span class="text-[11px] text-slate-500 font-mono block">{acc.email}</span>
                  </div>
                </div>

                <div class="flex items-center space-x-3">
                  <div class="text-right">
                    <span class="text-[10px] text-slate-600 font-mono block font-medium">
                      {(acc.driveQuotaUsedMb / 1024).toFixed(2)} GB / {(acc.driveQuotaTotalMb / 1024).toFixed(1)} GB
                    </span>
                    <span class="text-[9px] text-slate-400">
                      Google Cloud Storage
                    </span>
                  </div>
                  <button
                    class="p-1.5 rounded-full hover:bg-rose-50 text-slate-400 hover:text-rose-600 transition-colors"
                    on:click|stopPropagation={() => removeGoogleAccount(acc.id)}
                    title="Unlink Account"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            {/each}

            <!-- Other Cloud Accounts (TeraBox, OneDrive, Dropbox, Box, pCloud, Mega, WebDAV) -->
            {#each cAccounts.filter(c => c.provider !== 'google_drive') as cAcc}
              <div class="flex items-center justify-between p-3.5 rounded-2xl border bg-white border-slate-200">
                <div class="flex items-center space-x-3">
                  <div
                    class="w-9 h-9 rounded-full text-white font-bold flex items-center justify-center text-sm shadow-xs shrink-0"
                    style="background-color: {cAcc.avatarColor};"
                  >
                    {cAcc.provider === 'terabox' ? 'T' : cAcc.provider === 'onedrive' ? 'M' : cAcc.provider === 'dropbox' ? 'D' : cAcc.provider === 'box' ? 'B' : cAcc.provider === 'pcloud' ? 'P' : cAcc.provider === 'mega' ? 'M' : 'W'}
                  </div>
                  <div>
                    <div class="flex items-center space-x-2">
                      <span class="font-semibold text-slate-900 text-xs">{cAcc.name}</span>
                      <span class="px-1.5 py-0.2 rounded text-[9px] font-bold uppercase tracking-wider bg-blue-100 text-blue-800">
                        {cAcc.providerName}
                      </span>
                    </div>
                    <span class="text-[11px] text-slate-500 font-mono block">{cAcc.email}</span>
                  </div>
                </div>

                <div class="text-right">
                  <span class="text-[10px] text-slate-600 font-mono block font-medium">
                    {(cAcc.quotaUsedMb / 1024).toFixed(1)} GB / {(cAcc.quotaTotalMb / 1024).toFixed(1)} GB
                  </span>
                  <span class="text-[9px] text-slate-400">{cAcc.providerName}</span>
                </div>
              </div>
            {/each}
          </div>
        {/if}
      </div>
    </div>

    <!-- Footer -->
    <div class="px-6 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
      <div class="flex items-center space-x-1.5">
        <Lock size={12} class="text-slate-400" />
        <span>Local on-device storage is always available offline. Zero cloud lock-in.</span>
      </div>
      <button
        class="px-5 py-2 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-800 font-semibold transition-colors"
        on:click={() => dispatch('close')}
      >
        Done
      </button>
    </div>
  </div>
</div>
