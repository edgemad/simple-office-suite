/**
 * Microsoft Graph access to OneDrive and SharePoint.
 *
 * OneDrive (personal), OneDrive for Business, and SharePoint document
 * libraries are all the same Graph API against a "drive". A drive is
 * addressed differently but behaves identically, so one client covers all
 * three; the difference is only which drive id is used.
 *
 *   personal OneDrive      -> /me/drive
 *   business / SharePoint  -> /drives/{driveId}   or   /sites/{siteId}/drive
 *
 * OAuth is the same PKCE loopback flow Google uses (see oauth.ts), so no
 * client secret is embedded in the app.
 */

import type { CloudCredentials } from '../types';

export const GRAPH_BASE = 'https://graph.microsoft.com/v1.0';

/** Least privilege that still allows opening and saving documents. */
export const MICROSOFT_SCOPES = [
  'offline_access',
  'User.Read',
  // Delegated file access, not Sites.FullControl.All - this is enough to read
  // and write documents in libraries the user can already reach.
  'Files.ReadWrite',
] as const;

export const MICROSOFT_AUTHORIZE_URL =
  'https://login.microsoftonline.com/common/oauth2/v2.0/authorize';
export const MICROSOFT_TOKEN_URL =
  'https://login.microsoftonline.com/common/oauth2/v2.0/token';
export const MICROSOFT_SCOPE_STRING = MICROSOFT_SCOPES.join(' ');

/** Microsoft's client IDs are also prefixed with a UUID. */
export function isPlausibleMicrosoftClientId(clientId: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    clientId.trim()
  );
}

export interface GraphDriveItem {
  id: string;
  name: string;
  size: number;
  webUrl?: string;
  lastModifiedDateTime?: string;
  /** Present (as an object) on folders; absent on files. */
  folder?: { childCount?: number };
  /** Present on the parent when browsing a folder. */
  parentReference?: { driveId?: string; id?: string; path?: string };
  file?: { mimeType?: string };
}

export interface GraphDrive {
  id: string;
  name: string;
  driveType: string;
  webUrl?: string;
}

export interface GraphPage<T> {
  value: T[];
  '@odata.nextLink'?: string;
  '@odata.deltaLink'?: string;
}

async function graphFetch<T>(
  credentials: CloudCredentials,
  path: string,
  init: RequestInit = {}
): Promise<T> {
  if (!credentials.accessToken) {
    throw new Error('Not connected to Microsoft. Please sign in again.');
  }

  const response = await fetch(path.startsWith('http') ? path : `${GRAPH_BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${credentials.accessToken}`,
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
      ...(init.headers ?? {}),
    },
  });

  if (response.status === 401) {
    throw new Error(
      'Microsoft rejected the access token. It may have expired or been revoked; ' +
        'reconnect from the Drive panel.'
    );
  }
  if (response.status === 403) {
    throw new Error(
      'Microsoft denied access to this item. It may be in a library you do not ' +
        'have permission for, or protected by an organisational policy.'
    );
  }
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(
      `Microsoft Graph request failed (${response.status}): ${detail.slice(0, 300)}`
    );
  }

  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

/** The signed-in user's default drive: personal OneDrive or their business OneDrive. */
export async function getDefaultDrive(
  credentials: CloudCredentials
): Promise<GraphDrive> {
  return graphFetch<GraphDrive>(credentials, '/me/drive');
}

/** Every drive the user can reach - personal, business, and shared libraries. */
export async function listDrives(credentials: CloudCredentials): Promise<GraphDrive[]> {
  const page = await graphFetch<GraphPage<GraphDrive>>(credentials, '/me/drives');
  return page.value ?? [];
}

/**
 * Lists a folder's children, or the drive root when `folderId` is omitted.
 * `folderId` may be a Graph item id or a "root:/path" style address.
 */
export async function listFolder(
  credentials: CloudCredentials,
  folderId?: string,
  driveId?: string
): Promise<GraphPage<GraphDriveItem>> {
  const base = driveId ? `/drives/${encodeURIComponent(driveId)}` : '/me/drive';
  const target = folderId
    ? `${base}/items/${encodeURIComponent(folderId)}/children`
    : `${base}/root/children`;
  return graphFetch<GraphPage<GraphDriveItem>>(
    credentials,
    `${target}?$select=id,name,size,webUrl,lastModifiedDateTime,folder,file,parentReference&$top=200&$orderby=name`
  );
}

/** Walks up the parent chain to build breadcrumb navigation. */
export async function getItemPath(
  credentials: CloudCredentials,
  itemId: string
): Promise<GraphDriveItem[]> {
  const item = await graphFetch<GraphDriveItem>(
    credentials,
    `/me/drive/items/${encodeURIComponent(itemId)}?$select=id,name,parentReference`
  );

  const chain: GraphDriveItem[] = [item];
  let parentId = item.parentReference?.id;

  // Bounded so a cycle or a deep library cannot spin forever.
  for (let depth = 0; parentId && depth < 32; depth++) {
    const parent = await graphFetch<GraphDriveItem>(
      credentials,
      `/me/drive/items/${encodeURIComponent(parentId)}?$select=id,name,parentReference`
    );
    chain.unshift(parent);
    parentId = parent.parentReference?.id;
  }
  return chain;
}

/** Downloads a file's bytes. */
export async function downloadItem(
  credentials: CloudCredentials,
  itemId: string
): Promise<ArrayBuffer> {
  const response = await fetch(
    `${GRAPH_BASE}/me/drive/items/${encodeURIComponent(itemId)}/content`,
    { headers: { Authorization: `Bearer ${credentials.accessToken}` } }
  );
  if (response.status === 302 || response.status === 301) {
    // Graph answers with a redirect to a pre-signed download URL; follow it.
    return downloadFromRedirectUrl(response.headers.get('location'));
  }
  if (!response.ok) {
    throw new Error(`Failed to download from Microsoft (${response.status}).`);
  }
  return response.arrayBuffer();
}

async function downloadFromRedirectUrl(location: string | null): Promise<ArrayBuffer> {
  if (!location) {
    throw new Error('Microsoft did not provide a download location.');
  }
  const response = await fetch(location);
  if (!response.ok) {
    throw new Error(`Failed to fetch the file from Microsoft (${response.status}).`);
  }
  return response.arrayBuffer();
}

/** Creates or replaces a file's content. */
export async function uploadItem(
  credentials: CloudCredentials,
  fileName: string,
  body: ArrayBuffer,
  parentId?: string,
  /** Target library. Personal OneDrive when omitted. */
  driveId?: string
): Promise<GraphDriveItem> {
  // A SharePoint or business library is reached by addressing the drive
  // directly. Falling back to /me/drive would silently write the file into
  // the user's personal OneDrive instead of the library they chose.
  const base = driveId ? `/drives/${encodeURIComponent(driveId)}` : '/me/drive';
  if (parentId) {
    return graphFetch<GraphDriveItem>(credentials, `${base}/items/${encodeURIComponent(parentId)}:/children:/${encodeURIComponent(fileName)}:/content`, {
      method: 'PUT',
      body,
      headers: { 'Content-Type': 'application/octet-stream' },
    });
  }
  return graphFetch<GraphDriveItem>(
    credentials,
    `${base}/root:/${encodeURIComponent(fileName)}:/content`,
    { method: 'PUT', body, headers: { 'Content-Type': 'application/octet-stream' } }
  );
}

export function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

/** The Office types SOS reads, which is what this client speaks. */
export const MICROSOFT_OFFICE_MIME = {
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
} as const;

export interface MicrosoftFileKind {
  workspace: 'writer' | 'sheets' | 'slides' | null;
  label: string;
}

const EXTENSION_WORKSPACE: Record<string, 'writer' | 'sheets' | 'slides'> = {
  docx: 'writer',
  doc: 'writer',
  rtf: 'writer',
  odt: 'writer',
  txt: 'writer',
  md: 'writer',
  xlsx: 'sheets',
  xls: 'sheets',
  csv: 'sheets',
  ods: 'sheets',
  pptx: 'slides',
  ppt: 'slides',
  odp: 'slides',
};

/** Decides which workspace a file opens into, from its name alone. */
export function workspaceForFileName(name: string): MicrosoftFileKind {
  const extension = /\.([A-Za-z0-9]+)$/.exec(name)?.[1].toLowerCase() ?? '';
  const workspace = EXTENSION_WORKSPACE[extension] ?? null;
  return {
    workspace,
    label: workspace ? extension.toUpperCase() : 'File',
  };
}

/** Decides which workspace a Graph item opens into, from its name. */
export function workspaceForItem(item: GraphDriveItem): MicrosoftFileKind {
  if (item.folder) return { workspace: null, label: 'Folder' };
  return workspaceForFileName(item.name);
}
