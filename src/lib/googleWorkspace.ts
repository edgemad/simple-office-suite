/**
 * Google Workspace interop: file kinds, MIME mapping, and format conversion.
 *
 * Google stores Docs/Sheets/Slides as opaque internal formats, not as Office
 * XML. The way in and out is the Drive `export` endpoint, which renders a
 * Google-native file into another format on demand. That is what makes a
 * Google Doc openable here as .docx and a local .docx savable as a real Google
 * Doc, without either side knowing the other's internal format.
 *
 * All MIME knowledge is kept here, pure and tested, so a new workspace only
 * has to say "this is a document" and let the mapping resolve the rest.
 */

import type { WorkspaceMode } from '../types';

/** Native Google Workspace types — these cannot be downloaded directly. */
export const GOOGLE_MIME = {
  document: 'application/vnd.google-apps.document',
  spreadsheet: 'application/vnd.google-apps.spreadsheet',
  presentation: 'application/vnd.google-apps.presentation',
  form: 'application/vnd.google-apps.form',
  drawing: 'application/vnd.google-apps.drawing',
  folder: 'application/vnd.google-apps.folder',
  script: 'application/vnd.google-apps.script',
  shortcut: 'application/vnd.google-apps.shortcut',
} as const;

/** Office Open XML, which is what Drive renders Google-native files into. */
export const OFFICE_MIME = {
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
} as const;

/** Google-native rendering targets, for "save this as a Google Doc" flows. */
export const GOOGLE_EXPORT_MIME = {
  docx: GOOGLE_MIME.document,
  odt: 'application/vnd.oasis.opendocument.text',
  rtf: 'application/rtf',
  textPlain: 'text/plain',
  xlsx: GOOGLE_MIME.spreadsheet,
  ods: 'application/vnd.oasis.opendocument.spreadsheet',
  csv: 'text/csv',
  pptx: GOOGLE_MIME.presentation,
  odp: 'application/vnd.oasis.opendocument.presentation',
  pdf: 'application/pdf',
} as const;

export type GoogleFileKind =
  | 'document'
  | 'spreadsheet'
  | 'presentation'
  | 'form'
  | 'drawing'
  | 'folder'
  | 'script'
  | 'shortcut'
  | 'pdf'
  | 'image'
  | 'archive'
  | 'video'
  | 'audio'
  | 'text'
  | 'binary'
  | 'shortcut-other';

const EXTENSION_MIME: Record<string, string> = {
  docx: OFFICE_MIME.docx,
  xlsx: OFFICE_MIME.xlsx,
  pptx: OFFICE_MIME.pptx,
  odt: 'application/vnd.oasis.opendocument.text',
  ods: 'application/vnd.oasis.opendocument.spreadsheet',
  odp: 'application/vnd.oasis.opendocument.presentation',
  rtf: 'application/rtf',
  txt: 'text/plain',
  md: 'text/markdown',
  csv: 'text/csv',
  pdf: 'application/pdf',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
  svg: 'image/svg+xml',
  zip: 'application/zip',
  mp4: 'video/mp4',
  mov: 'video/quicktime',
  mp3: 'audio/mpeg',
  json: 'application/json',
};

export function kindForMime(mimeType: string): GoogleFileKind {
  switch (mimeType) {
    case GOOGLE_MIME.document:
      return 'document';
    case GOOGLE_MIME.spreadsheet:
      return 'spreadsheet';
    case GOOGLE_MIME.presentation:
      return 'presentation';
    case GOOGLE_MIME.form:
      return 'form';
    case GOOGLE_MIME.drawing:
      return 'drawing';
    case GOOGLE_MIME.folder:
      return 'folder';
    case GOOGLE_MIME.script:
      return 'script';
    case GOOGLE_MIME.shortcut:
      return 'shortcut';
    case 'application/pdf':
      return 'pdf';
    default:
      break;
  }
  if (mimeType.startsWith('image/')) return 'image';
  if (mimeType.startsWith('video/')) return 'video';
  if (mimeType.startsWith('audio/')) return 'audio';
  if (mimeType === 'application/zip') return 'archive';
  if (mimeType.startsWith('text/')) return 'text';
  return 'binary';
}

/**
 * Google-native types have no byte representation, so Drive refuses a plain
 * `alt=media` download. They must go through `export`.
 */
/**
 * True for Google's own document types (Docs, Sheets, Slides, Forms).
 *
 * These are not real files: the Drive API cannot write their content, only
 * read/export it. Anything that wants to save into one has to work around
 * that rather than assume a plain upload will work.
 */
export function isGoogleNative(mimeType: string): boolean {
  return mimeType.startsWith('application/vnd.google-apps.') && !mimeType.endsWith('.shortcut');
}

export function requiresExport(mimeType: string): boolean {
  return Object.values(GOOGLE_MIME).includes(mimeType as never);
}

/** True when a file of this MIME can be opened into an SOS workspace. */
export function isOpenableInSos(mimeType: string): boolean {
  const kind = kindForMime(mimeType);
  return (
    kind === 'document' ||
    kind === 'spreadsheet' ||
    kind === 'presentation' ||
    kind === 'form' ||
    mimeType === OFFICE_MIME.docx ||
    mimeType === OFFICE_MIME.xlsx ||
    mimeType === OFFICE_MIME.pptx ||
    mimeType === 'application/rtf' ||
    mimeType === 'text/plain' ||
    mimeType === 'text/markdown' ||
    mimeType === 'text/csv' ||
    mimeType === 'application/vnd.oasis.opendocument.text' ||
    mimeType === 'application/vnd.oasis.opendocument.spreadsheet' ||
    mimeType === 'application/vnd.oasis.opendocument.presentation'
  );
}

/** Which SOS workspace a Drive file opens into, if any. */
export function workspaceForMime(mimeType: string): WorkspaceMode | null {
  const kind = kindForMime(mimeType);
  if (kind === 'document') return 'writer';
  if (kind === 'spreadsheet') return 'sheets';
  if (kind === 'presentation') return 'slides';
  if (kind === 'form') return 'forms';
  if (mimeType === OFFICE_MIME.docx) return 'writer';
  if (mimeType === OFFICE_MIME.xlsx) return 'sheets';
  if (mimeType === OFFICE_MIME.pptx) return 'slides';
  if (
    mimeType === 'application/rtf' ||
    mimeType === 'text/plain' ||
    mimeType === 'text/markdown' ||
    mimeType === 'application/vnd.oasis.opendocument.text'
  ) {
    return 'writer';
  }
  if (mimeType === 'text/csv' || mimeType === 'application/vnd.oasis.opendocument.spreadsheet') {
    return 'sheets';
  }
  if (mimeType === 'application/vnd.oasis.opendocument.presentation') return 'slides';
  return null;
}

/** The Office Open XML type each workspace reads. */
export function officeMimeFor(mode: WorkspaceMode): string | null {
  switch (mode) {
    case 'writer':
      return OFFICE_MIME.docx;
    case 'sheets':
      return OFFICE_MIME.xlsx;
    case 'slides':
      return OFFICE_MIME.pptx;
    default:
      // Forms are only a Google-native type; there is no Office equivalent to
      // export them to, so they cannot round-trip through a local file.
      return null;
  }
}

/**
 * The MIME to ask Drive for when pulling a file into `mode`, or null when the
 * file should be fetched as-is.
 *
 * A Google-native file has no bytes of its own, so it must be rendered. A file
 * that is already the right Office type is downloaded untouched — exporting it
 * would round-trip it through Drive for nothing.
 */
export function exportMimeFor(mimeType: string, mode: WorkspaceMode): string | null {
  const target = officeMimeFor(mode);
  if (!target) return null;
  if (mimeType === target) return null;
  if (requiresExport(mimeType)) return target;
  return null;
}

/** The MIME to upload with when saving `mode` content back to Drive. */
export function uploadMimeFor(mode: WorkspaceMode, asGoogleNative: boolean): string {
  if (asGoogleNative) {
    switch (mode) {
      case 'writer':
        return GOOGLE_MIME.document;
      case 'sheets':
        return GOOGLE_MIME.spreadsheet;
      case 'slides':
        return GOOGLE_MIME.presentation;
      default:
        break;
    }
  }
  switch (mode) {
    case 'writer':
      return OFFICE_MIME.docx;
    case 'sheets':
      return OFFICE_MIME.xlsx;
    case 'slides':
      return OFFICE_MIME.pptx;
    default:
      return 'application/json';
  }
}

export function extensionForMime(mimeType: string): string {
  for (const [ext, mime] of Object.entries(EXTENSION_MIME)) {
    if (mime === mimeType) return ext;
  }
  return 'bin';
}

/** Short human label for a Drive row, e.g. "Google Doc" or "DOCX". */
export function describeFile(name: string, mimeType: string): string {
  const kind = kindForMime(mimeType);
  const labels: Partial<Record<GoogleFileKind, string>> = {
    document: 'Google Doc',
    spreadsheet: 'Google Sheet',
    presentation: 'Google Slides',
    form: 'Google Form',
    drawing: 'Google Drawing',
    folder: 'Folder',
    script: 'Apps Script',
    pdf: 'PDF',
    image: 'Image',
    archive: 'Archive',
    video: 'Video',
    audio: 'Audio',
  };
  if (labels[kind]) return labels[kind] as string;
  if (kind === 'text') return 'Text';

  // Drive leaves some uploads with a generic type, so fall back to the name.
  const fromName = /\.[A-Za-z0-9]+$/.exec(name)?.[0].slice(1).toLowerCase();
  if (fromName && EXTENSION_MIME[fromName]) return fromName.toUpperCase();
  return extensionForMime(mimeType).toUpperCase();
}

/**
 * A server-side query for browsing one folder.
 *
 * Folders are included deliberately: a file browser has to show them or the
 * user cannot descend into a subfolder. Shortcuts are excluded because they
 * resolve to files that are already listed, and showing both is confusing.
 *
 * Filtering server-side matters on a real Drive - otherwise every unrelated
 * file in the account is downloaded just to be hidden in the UI.
 */
export function buildBrowseQuery(folderId?: string): string {
  const clauses = [
    'trashed = false',
    `mimeType != '${GOOGLE_MIME.shortcut}'`,
  ];
  if (folderId) {
    clauses.push(`'${folderId}' in parents`);
  } else {
    clauses.push("'root' in parents");
  }
  return clauses.join(' and ');
}
