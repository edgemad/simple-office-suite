/**
 * Writing a document back to the cloud.
 *
 * Opening is only half the round trip: a user who opens a file from Drive
 * expects to be able to save it again, otherwise the browser view is a
 * read-only detour.
 *
 * A caveat worth stating plainly. Google-native Docs/Sheets/Slides cannot be
 * written by the Drive API at all - a .docx cannot be saved into a native
 * Google Doc. Converting between them needs the Docs/Sheets/Slides APIs. So for
 * a native file this saves the Office format alongside it rather than
 * pretending to update in place, which would destroy the original.
 */

import type { CloudCredentials } from '../types';
import { uploadToDrive, type GoogleDriveFile } from './googleDriveClient';
import { GOOGLE_MIME, isGoogleNative } from './googleWorkspace';
import { uploadItem as graphUpload } from './microsoftGraph';
import { toUploadBytes } from './uploadBytes';

export interface SaveRequest {
  provider: 'google' | 'microsoft';
  credentials: CloudCredentials;
  fileName: string;
  mimeType: string;
  bytes: ArrayBuffer;
  /** Folder to write into. */
  folderId?: string;
  /** Overwrite this file rather than creating a new one. */
  fileId?: string;
}

export interface SaveResult {
  id: string;
  name: string;
  webUrl?: string;
  /** True when the target was a Google-native file that cannot be written to. */
  savedAsCopy: boolean;
  note?: string;
}

export async function saveToCloud(request: SaveRequest): Promise<SaveResult> {
  return request.provider === 'google' ? saveToGoogle(request) : saveToMicrosoft(request);
}

async function saveToGoogle(request: SaveRequest): Promise<SaveResult> {
  const token = request.credentials.accessToken;
  if (!token) throw new Error('Not connected to Google Drive. Please sign in again.');

  // Writing into a native Google Doc silently fails or corrupts the file, so
  // save a new Office file and leave the original alone.
  const native = isGoogleNative(request.mimeType) || isGoogleNativeForName(request.fileName);
  const targetName = native ? withOfficeExtension(request.fileName, request.mimeType) : request.fileName;
  const targetMime = native ? request.mimeType : request.mimeType;

  // An update in place only makes sense for a real Office file we own.
  const fileId = native ? undefined : request.fileId;

  const uploaded: GoogleDriveFile = await uploadToDrive(token, {
    name: targetName,
    mimeType: targetMime,
    content: toUploadBytes(request.bytes),
    parentId: request.folderId,
    fileId,
  });

  return {
    id: uploaded.id,
    name: uploaded.name,
    webUrl: uploaded.webViewLink,
    savedAsCopy: native,
    note: native
      ? `Google-native files cannot be written by the Drive API, so this was saved as ${targetName}. The original was left unchanged.`
      : undefined,
  };
}

async function saveToMicrosoft(request: SaveRequest): Promise<SaveResult> {
  if (!request.credentials.accessToken) {
    throw new Error('Not connected to Microsoft. Please sign in again.');
  }

  const bytes = toUploadBytes(request.bytes);
  const uploaded = await graphUpload(
    request.credentials,
    request.fileName,
    bytes.buffer as ArrayBuffer,
    request.folderId
  );

  return {
    id: uploaded.id,
    name: uploaded.name,
    webUrl: uploaded.webUrl,
    savedAsCopy: false,
  };
}

/** True when the file is a Google-native type, by MIME or by extension. */
function isGoogleNativeForName(name: string): boolean {
  return /\.(gdoc|gsheet|gslide)$/i.test(name);
}

/** Google-native files are named without an extension; give the copy a real one. */
function withOfficeExtension(name: string, mimeType: string): string {
  if (/\.[A-Za-z0-9]+$/.test(name)) return name;

  const extension =
    mimeType === GOOGLE_MIME.document
      ? 'docx'
      : mimeType === GOOGLE_MIME.spreadsheet
        ? 'xlsx'
        : mimeType === GOOGLE_MIME.presentation
          ? 'pptx'
          : 'docx';
  return `${name}.${extension}`;
}
