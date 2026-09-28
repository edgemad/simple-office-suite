/**
 * A file listing the Drive panel can render, independent of provider.
 *
 * Google and Microsoft disagree about drive addressing, pagination, and
 * item shape. The panel should not care, so both are flattened into this.
 */

import type { CloudCredentials } from '../types';
import {
  listFolder,
  getDefaultDrive,
  getItemPath,
  type GraphDriveItem,
} from './microsoftGraph';
import { listDriveFiles, type GoogleDriveFile } from './googleDriveClient';
import { workspaceForFileName } from './microsoftGraph';

export interface CloudEntry {
  id: string;
  name: string;
  /** Bytes. */
  size: number;
  isFolder: boolean;
  modifiedAt?: string;
  /** Set when the provider can show this in its own web UI. */
  webUrl?: string;
  /** Which workspace opening it should route to, when known. */
  workspace: 'writer' | 'sheets' | 'slides' | null;
  /** Provider-native type, useful for "Save as Google Doc" style actions. */
  nativeKind?: string;
}

export interface CloudCrumb {
  id?: string;
  name: string;
}

/** Microsoft's driveType, mapped onto the provider labels the UI shows. */
function driveTypeOf(driveType: string): 'personal' | 'business' | 'sharepoint' {
  if (driveType === 'personal') return 'personal';
  return 'business';
}

function fromGraph(item: GraphDriveItem): CloudEntry {
  const isFolder = Boolean(item.folder);
  return {
    id: item.id,
    name: item.name,
    size: item.size ?? 0,
    isFolder,
    modifiedAt: item.lastModifiedDateTime,
    webUrl: item.webUrl,
    workspace: isFolder ? null : workspaceForFileName(item.name).workspace,
  };
}

function fromGoogle(file: GoogleDriveFile): CloudEntry {
  const isFolder = file.mimeType === 'application/vnd.google-apps.folder';
  const native = file.mimeType?.startsWith('application/vnd.google-apps.')
    ? file.mimeType.slice('application/vnd.google-apps.'.length)
    : undefined;

  return {
    id: file.id,
    name: file.name,
    size: Number(file.size ?? 0),
    isFolder,
    modifiedAt: file.modifiedTime,
    webUrl: file.webViewLink,
    workspace: isFolder ? null : workspaceForFileName(file.name).workspace,
    nativeKind: native,
  };
}

/** Sorts folders first, then by name, so browsing feels predictable. */
export function sortEntries(entries: CloudEntry[]): CloudEntry[] {
  return [...entries].sort((a, b) => {
    if (a.isFolder !== b.isFolder) return a.isFolder ? -1 : 1;
    return a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' });
  });
}

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit++;
  }
  return `${value >= 10 || unit === 0 ? Math.round(value) : value.toFixed(1)} ${units[unit]}`;
}

export interface ListResult {
  entries: CloudEntry[];
  crumbs: CloudCrumb[];
  /** Human name of the backing library, e.g. "OneDrive" or a SharePoint site. */
  locationName: string;
}

export interface ListArgs {
  provider: 'google' | 'microsoft';
  credentials: CloudCredentials;
  folderId?: string;
  /** Pin a specific library, e.g. a SharePoint drive. */
  driveId?: string;
}

export async function listEntries(args: ListArgs): Promise<ListResult> {
  if (args.provider === 'google') {
    return listGoogle(args);
  }
  return listMicrosoft(args);
}

async function listGoogle(args: ListArgs): Promise<ListResult> {
  const { accessToken } = args.credentials;
  if (!accessToken) throw new Error('Not connected to Google Drive. Please sign in again.');

  // listDriveFiles predates the credentials object and takes a bare token.
  const files = await listDriveFiles(accessToken, { folderId: args.folderId });
  const entries = sortEntries(files.map(fromGoogle));
  return {
    entries,
    // Google has no cheap parent walk in the files.list response, so the
    // trail is just the current folder.
    crumbs: [{ name: 'My Drive' }, ...(args.folderId ? [{ name: 'This folder' }] : [])],
    locationName: 'Google Drive',
  };
}

async function listMicrosoft(args: ListArgs): Promise<ListResult> {
  const drive = args.driveId
    ? { id: args.driveId, name: 'Selected library', driveType: args.driveId }
    : await getDefaultDrive(args.credentials);

  const page = await listFolder(args.credentials, args.folderId, args.driveId);
  const entries = sortEntries((page.value ?? []).map(fromGraph));

  // Breadcrumbs need a parent walk, which is per-item; only do it when the
  // user is actually inside a folder to avoid N+1 calls on the root.
  const crumbs: CloudCrumb[] = [{ name: drive.name }];
  if (args.folderId) {
    try {
      const chain = await getItemPath(args.credentials, args.folderId);
      crumbs.push(...chain.map((item) => ({ id: item.id, name: item.name })));
    } catch {
      crumbs.push({ name: 'This folder' });
    }
  }

  return {
    entries,
    crumbs,
    locationName:
      driveTypeOf(drive.driveType) === 'personal' ? 'OneDrive' : (drive.name ?? 'OneDrive'),
  };
}

export interface Library {
  id: string;
  name: string;
  kind: 'personal' | 'business' | 'sharepoint';
  webUrl?: string;
}

/**
 * Lists the Microsoft libraries a user can switch between - the practical
 * "SharePoint too" entry point, since SharePoint shows up here as a library.
 */
export async function listMicrosoftLibraries(
  credentials: CloudCredentials
): Promise<Library[]> {
  const { listDrives } = await import('./microsoftGraph');
  const drives = await listDrives(credentials);
  return drives.map((drive) => {
    const kind = drive.driveType === 'personal' ? 'personal' : 'business';
    return { id: drive.id, name: drive.name, kind, webUrl: drive.webUrl };
  });
}
