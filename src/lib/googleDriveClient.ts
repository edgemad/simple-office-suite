/**
 * Google Drive REST API v3 & OAuth 2.0 Client
 *
 * Live cloud synchronization for SOS. Tokens are held in the OS-side secret
 * store rather than on the account record; see lib/secureStore.ts.
 */

import type { CloudCredentials, GoogleAccount, GoogleDriveFile } from '../types';
import { loadSecret, secretKeyForAccount, storeSecret } from './secureStore';

export type { GoogleDriveFile } from '../types';

export interface DriveAboutInfo {
  user: {
    displayName: string;
    emailAddress: string;
    photoLink?: string;
  };
  storageQuota: {
    limit?: string;
    usage?: string;
    usageInDrive?: string;
  };
}

export interface UploadOptions {
  name: string;
  mimeType: string;
  content: string | Uint8Array | Blob;
  parentId?: string;
  fileId?: string;
}

const DRIVE_API_BASE = 'https://www.googleapis.com/drive/v3';
const DRIVE_UPLOAD_BASE = 'https://www.googleapis.com/upload/drive/v3';
const OAUTH_TOKEN_URL = 'https://oauth2.googleapis.com/token';

/**
 * Generate Google OAuth 2.0 Authorization URL
 */
export function buildGoogleOAuthUrl(
  clientId: string,
  redirectUri: string = 'urn:ietf:wg:oauth:2.0:oob'
): string {
  const scopes = [
    'https://www.googleapis.com/auth/drive.file',
    'https://www.googleapis.com/auth/drive.metadata.readonly',
    'https://www.googleapis.com/auth/userinfo.profile',
    'https://www.googleapis.com/auth/userinfo.email',
  ].join(' ');

  const params = new URLSearchParams({
    client_id: clientId.trim(),
    redirect_uri: redirectUri.trim(),
    response_type: 'code',
    scope: scopes,
    access_type: 'offline',
    prompt: 'consent',
  });

  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

/**
 * Exchange OAuth 2.0 authorization code for Access & Refresh tokens
 */
export async function exchangeOAuthCode(
  code: string,
  clientId: string,
  clientSecret?: string,
  redirectUri: string = 'urn:ietf:wg:oauth:2.0:oob'
): Promise<{
  accessToken: string;
  refreshToken?: string;
  expiresIn: number;
}> {
  const bodyParams: Record<string, string> = {
    code: code.trim(),
    client_id: clientId.trim(),
    redirect_uri: redirectUri.trim(),
    grant_type: 'authorization_code',
  };

  if (clientSecret && clientSecret.trim()) {
    bodyParams.client_secret = clientSecret.trim();
  }

  const response = await fetch(OAUTH_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(bodyParams).toString(),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Google OAuth token exchange failed (${response.status}): ${errorText}`);
  }

  const data = await response.json();
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresIn: data.expires_in || 3600,
  };
}

/**
 * Refresh an expired access token using the stored refresh token
 */
export async function refreshGoogleAccessToken(
  refreshToken: string,
  clientId: string,
  clientSecret?: string
): Promise<{ accessToken: string; expiresIn: number }> {
  const bodyParams: Record<string, string> = {
    refresh_token: refreshToken.trim(),
    client_id: clientId.trim(),
    grant_type: 'refresh_token',
  };

  if (clientSecret && clientSecret.trim()) {
    bodyParams.client_secret = clientSecret.trim();
  }

  const response = await fetch(OAUTH_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(bodyParams).toString(),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to refresh Google token (${response.status}): ${errorText}`);
  }

  const data = await response.json();
  return {
    accessToken: data.access_token,
    expiresIn: data.expires_in || 3600,
  };
}

/**
 * Get a valid access token for an account, refreshing if expired.
 *
 * The token is not on the account. It is read from the secure store, refreshed
 * when stale, and written back there, so a refreshed token is never persisted
 * into webview storage.
 */
export async function ensureValidAccessToken(
  account: GoogleAccount,
  onTokenRefreshed?: (updatedAccount: GoogleAccount) => void
): Promise<string> {
  const secretKey = secretKeyForAccount(account.id);
  const stored = await loadSecret(secretKey);
  if (!stored) {
    throw new Error('No Google credentials found for this account. Please reconnect.');
  }

  let credentials: CloudCredentials;
  try {
    credentials = JSON.parse(stored) as CloudCredentials;
  } catch {
    throw new Error('Stored Google credentials are unreadable. Please reconnect.');
  }

  if (!credentials.accessToken) {
    throw new Error('No Google access token found for account. Please reconnect.');
  }

  const isExpired = credentials.tokenExpiresAt
    ? Date.now() > credentials.tokenExpiresAt - 60000
    : false;

  if (isExpired && credentials.refreshToken && credentials.clientId) {
    try {
      const refreshed = await refreshGoogleAccessToken(
        credentials.refreshToken,
        credentials.clientId,
        credentials.clientSecret
      );
      const updated: CloudCredentials = {
        ...credentials,
        accessToken: refreshed.accessToken,
        tokenExpiresAt: Date.now() + refreshed.expiresIn * 1000,
      };
      await storeSecret(secretKey, JSON.stringify(updated));
      if (onTokenRefreshed) {
        onTokenRefreshed({ ...account, hasCredentials: true });
      }
      return updated.accessToken as string;
    } catch (err) {
      console.warn('Token auto-refresh failed, trying current token:', err);
    }
  }

  return credentials.accessToken;
}

/**
 * Fetch real user profile and cloud storage quota from Google Drive API
 */
export async function fetchDriveAbout(accessToken: string): Promise<DriveAboutInfo> {
  const response = await fetch(`${DRIVE_API_BASE}/about?fields=user,storageQuota`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Google Drive API error (${response.status}): ${err}`);
  }

  return await response.json();
}

/**
 * List real files and folders from Google Drive
 */
export async function listDriveFiles(
  accessToken: string,
  options?: {
    folderId?: string;
    query?: string;
    pageSize?: number;
  }
): Promise<GoogleDriveFile[]> {
  const conditions: string[] = ['trashed = false'];

  if (options?.folderId) {
    conditions.push(`'${options.folderId}' in parents`);
  }

  if (options?.query) {
    conditions.push(`name contains '${options.query.replace(/'/g, "\\'")}'`);
  }

  const params = new URLSearchParams({
    pageSize: String(options?.pageSize || 100),
    fields: 'nextPageToken,files(id,name,mimeType,modifiedTime,size,webViewLink,parents,iconLink,thumbnailLink,trashed)',
    q: conditions.join(' and '),
    orderBy: 'folder,modifiedTime desc',
  });

  const response = await fetch(`${DRIVE_API_BASE}/files?${params.toString()}`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Failed to list Google Drive files (${response.status}): ${err}`);
  }

  const data = await response.json();
  return data.files || [];
}

/**
 * Upload a document or file directly to Google Drive via multipart upload
 */
export async function uploadToDrive(
  accessToken: string,
  options: UploadOptions
): Promise<GoogleDriveFile> {
  const isUpdate = !!options.fileId;
  const url = isUpdate
    ? `${DRIVE_UPLOAD_BASE}/files/${options.fileId}?uploadType=multipart&fields=id,name,mimeType,modifiedTime,size,webViewLink`
    : `${DRIVE_UPLOAD_BASE}/files?uploadType=multipart&fields=id,name,mimeType,modifiedTime,size,webViewLink`;

  const metadata: Record<string, any> = {
    name: options.name,
    mimeType: options.mimeType,
  };

  if (!isUpdate && options.parentId) {
    metadata.parents = [options.parentId];
  }

  const boundary = '-------SimpleOfficeSuiteBoundary' + Math.random().toString(36).substring(2);
  const delimiter = `\r\n--${boundary}\r\n`;
  const closeDelimiter = `\r\n--${boundary}--`;

  const metaHeader = 'Content-Type: application/json; charset=UTF-8\r\n\r\n';
  const dataHeader = `Content-Type: ${options.mimeType}\r\n\r\n`;

  let bodyContent: string;
  if (typeof options.content === 'string') {
    bodyContent = options.content;
  } else if (options.content instanceof Uint8Array) {
    bodyContent = new TextDecoder().decode(options.content);
  } else {
    bodyContent = '';
  }

  const multipartBody =
    delimiter +
    metaHeader +
    JSON.stringify(metadata) +
    delimiter +
    dataHeader +
    bodyContent +
    closeDelimiter;

  const response = await fetch(url, {
    method: isUpdate ? 'PATCH' : 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': `multipart/related; boundary=${boundary}`,
    },
    body: multipartBody,
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Drive upload failed (${response.status}): ${err}`);
  }

  return await response.json();
}

/**
 * Download file content from Google Drive
 */
export async function downloadDriveFile(
  accessToken: string,
  fileId: string,
  exportMimeType?: string
): Promise<string> {
  let url = `${DRIVE_API_BASE}/files/${fileId}?alt=media`;

  if (exportMimeType) {
    url = `${DRIVE_API_BASE}/files/${fileId}/export?mimeType=${encodeURIComponent(exportMimeType)}`;
  }

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Failed to download file from Google Drive (${response.status}): ${err}`);
  }

  return await response.text();
}

/**
 * Create a new folder in Google Drive
 */
export async function createDriveFolder(
  accessToken: string,
  folderName: string,
  parentId?: string
): Promise<GoogleDriveFile> {
  const metadata: Record<string, any> = {
    name: folderName,
    mimeType: 'application/vnd.google-apps.folder',
  };

  if (parentId) {
    metadata.parents = [parentId];
  }

  const response = await fetch(`${DRIVE_API_BASE}/files`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(metadata),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Failed to create Google Drive folder (${response.status}): ${err}`);
  }

  return await response.json();
}

/**
 * Move file to trash in Google Drive
 */
export async function trashDriveFile(accessToken: string, fileId: string): Promise<void> {
  const response = await fetch(`${DRIVE_API_BASE}/files/${fileId}`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ trashed: true }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Failed to trash file in Google Drive (${response.status}): ${err}`);
  }
}
