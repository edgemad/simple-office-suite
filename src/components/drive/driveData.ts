import type { CloudDriveProvider } from '../../types';

export type DriveItemType = 'doc' | 'sheet' | 'slide' | 'form' | 'pdf' | 'folder';

export interface DriveItem {
  id: string;
  name: string;
  type: DriveItemType;
  owner: string;
  ownerAvatar?: string;
  isOwner: boolean;
  sharedWith?: string[];
  lastModified: string;
  lastModifiedTimestamp: number;
  lastModifiedBy: string;
  fileSize: string;
  fileSizeBytes: number;
  isStarred: boolean;
  isTrashed: boolean;
  isSpam?: boolean;
  folderId?: string | null;
  workspaceDocId?: string;
  thumbnailColor?: string;
  contentSnippet?: string;
  tags?: string[];
  cloudFileId?: string;
  cloudWebViewLink?: string;
  isCloudSynced?: boolean;
  storageLocation?: 'local' | 'cloud';
  provider?: CloudDriveProvider;
}

// Built-in offline local starter templates
export const DEFAULT_LOCAL_ITEMS: DriveItem[] = [
  {
    id: 'local_folder_work',
    name: 'Work Projects',
    type: 'folder',
    owner: 'Me',
    isOwner: true,
    lastModified: 'Yesterday',
    lastModifiedTimestamp: Date.now() - 86400000,
    lastModifiedBy: 'Me',
    fileSize: '—',
    fileSizeBytes: 0,
    isStarred: true,
    isTrashed: false,
    folderId: null,
    thumbnailColor: '#4285F4',
    storageLocation: 'local',
  },
  {
    id: 'local_folder_personal',
    name: 'Personal Documents',
    type: 'folder',
    owner: 'Me',
    isOwner: true,
    lastModified: '2 days ago',
    lastModifiedTimestamp: Date.now() - 172800000,
    lastModifiedBy: 'Me',
    fileSize: '—',
    fileSizeBytes: 0,
    isStarred: false,
    isTrashed: false,
    folderId: null,
    thumbnailColor: '#34A853',
    storageLocation: 'local',
  },
  {
    id: 'local_doc_welcome',
    name: 'Welcome to Simple Office Suite.docx',
    type: 'doc',
    owner: 'Me',
    isOwner: true,
    lastModified: 'Just now',
    lastModifiedTimestamp: Date.now() - 120000,
    lastModifiedBy: 'Me',
    fileSize: '14 KB',
    fileSizeBytes: 14200,
    isStarred: true,
    isTrashed: false,
    folderId: null,
    contentSnippet: 'Welcome to your offline-first productivity suite. Edit documents, analyze data, and build slide presentations completely offline...',
    storageLocation: 'local',
  },
  {
    id: 'local_sheet_budget',
    name: 'Quarterly Budget & Financial Forecast.xlsx',
    type: 'sheet',
    owner: 'Me',
    isOwner: true,
    lastModified: 'Today, 8:30 AM',
    lastModifiedTimestamp: Date.now() - 3600000,
    lastModifiedBy: 'Me',
    fileSize: '32 KB',
    fileSizeBytes: 32400,
    isStarred: false,
    isTrashed: false,
    folderId: null,
    contentSnippet: 'Quarterly financial model with automated revenue forecasting, department expenses, and variance analysis...',
    storageLocation: 'local',
  },
  {
    id: 'local_slide_pitch',
    name: 'Company Strategy & Pitch Deck.pptx',
    type: 'slide',
    owner: 'Me',
    isOwner: true,
    lastModified: 'Yesterday',
    lastModifiedTimestamp: Date.now() - 86400000,
    lastModifiedBy: 'Me',
    fileSize: '1.4 MB',
    fileSizeBytes: 1400000,
    isStarred: true,
    isTrashed: false,
    folderId: null,
    contentSnippet: 'Comprehensive executive slide deck with growth pillars, market opportunity, and roadmap...',
    storageLocation: 'local',
  },
  {
    id: 'local_form_survey',
    name: 'Customer Feedback & NPS Survey.form',
    type: 'form',
    owner: 'Me',
    isOwner: true,
    lastModified: '3 days ago',
    lastModifiedTimestamp: Date.now() - 259200000,
    lastModifiedBy: 'Me',
    fileSize: '18 KB',
    fileSizeBytes: 18000,
    isStarred: false,
    isTrashed: false,
    folderId: null,
    contentSnippet: 'Interactive feedback questionnaire evaluating user satisfaction, feature requests, and net promoter score...',
    storageLocation: 'local',
  },
  {
    id: 'local_pdf_manual',
    name: 'Offline Productivity Guide.pdf',
    type: 'pdf',
    owner: 'Simple Office',
    isOwner: false,
    lastModified: 'Sep 24, 2026',
    lastModifiedTimestamp: Date.now() - 172800000,
    lastModifiedBy: 'Simple Office',
    fileSize: '240 KB',
    fileSizeBytes: 245760,
    isStarred: false,
    isTrashed: false,
    folderId: null,
    contentSnippet: 'Official guide for utilizing local offline word processing, spreadsheet formulas, presentation builder, and cloud synchronization.',
    storageLocation: 'local',
  },
];

const STORAGE_KEY = 'office_drive_items_v3';

export function loadDriveItems(): DriveItem[] {
  if (typeof window === 'undefined' || !window.localStorage) {
    return DEFAULT_LOCAL_ITEMS;
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      saveDriveItems(DEFAULT_LOCAL_ITEMS);
      return DEFAULT_LOCAL_ITEMS;
    }
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed;
    }
    // If empty array was saved, seed with default local items so offline storage is useful
    saveDriveItems(DEFAULT_LOCAL_ITEMS);
    return DEFAULT_LOCAL_ITEMS;
  } catch (err) {
    console.warn('Failed to load drive items from storage:', err);
    return DEFAULT_LOCAL_ITEMS;
  }
}

export function saveDriveItems(items: DriveItem[]): void {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  } catch (err) {
    console.error('Failed to save drive items to storage:', err);
  }
}

export function convertGoogleDriveFileToDriveItem(file: any): DriveItem {
  let type: DriveItemType = 'doc';
  const mime = file.mimeType || '';
  if (mime === 'application/vnd.google-apps.folder') type = 'folder';
  else if (mime.includes('spreadsheet') || mime.includes('excel')) type = 'sheet';
  else if (mime.includes('presentation') || mime.includes('powerpoint')) type = 'slide';
  else if (mime.includes('form')) type = 'form';
  else if (mime.includes('pdf')) type = 'pdf';
  else if (mime.includes('document') || mime.includes('word')) type = 'doc';

  const modified = file.modifiedTime ? new Date(file.modifiedTime) : new Date();
  const bytes = file.size ? parseInt(file.size, 10) : 0;
  const sizeStr = bytes > 0 ? (bytes > 1048576 ? `${(bytes / 1048576).toFixed(1)} MB` : `${(bytes / 1024).toFixed(0)} KB`) : '—';

  return {
    id: `gdrive_${file.id}`,
    cloudFileId: file.id,
    name: file.name,
    type,
    owner: 'Google Drive',
    isOwner: true,
    lastModified: modified.toLocaleDateString(),
    lastModifiedTimestamp: modified.getTime(),
    lastModifiedBy: 'Google Drive',
    fileSize: sizeStr,
    fileSizeBytes: bytes,
    isStarred: false,
    isTrashed: file.trashed || false,
    folderId: file.parents && file.parents.length > 0 ? file.parents[0] : null,
    cloudWebViewLink: file.webViewLink,
    isCloudSynced: true,
    storageLocation: 'cloud',
    provider: 'google_drive',
  };
}

export function convertOneDriveFileToDriveItem(file: any): DriveItem {
  let type: DriveItemType = 'doc';
  if (file.folder) type = 'folder';
  else if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls') || file.name.endsWith('.csv')) type = 'sheet';
  else if (file.name.endsWith('.pptx') || file.name.endsWith('.ppt')) type = 'slide';
  else if (file.name.endsWith('.pdf')) type = 'pdf';
  else if (file.name.endsWith('.docx') || file.name.endsWith('.doc')) type = 'doc';

  const modified = file.lastModifiedDateTime ? new Date(file.lastModifiedDateTime) : new Date();
  const bytes = file.size || 0;
  const sizeStr = bytes > 0 ? (bytes > 1048576 ? `${(bytes / 1048576).toFixed(1)} MB` : `${(bytes / 1024).toFixed(0)} KB`) : '—';

  return {
    id: `onedrive_${file.id}`,
    cloudFileId: file.id,
    name: file.name,
    type,
    owner: 'OneDrive',
    isOwner: true,
    lastModified: modified.toLocaleDateString(),
    lastModifiedTimestamp: modified.getTime(),
    lastModifiedBy: 'OneDrive',
    fileSize: sizeStr,
    fileSizeBytes: bytes,
    isStarred: false,
    isTrashed: false,
    folderId: file.parentReference?.id || null,
    cloudWebViewLink: file.webUrl,
    isCloudSynced: true,
    storageLocation: 'cloud',
    provider: 'onedrive',
  };
}

export function convertDropboxFileToDriveItem(file: any): DriveItem {
  const isFolder = file['.tag'] === 'folder';
  let type: DriveItemType = isFolder ? 'folder' : 'doc';
  if (!isFolder) {
    if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls') || file.name.endsWith('.csv')) type = 'sheet';
    else if (file.name.endsWith('.pptx') || file.name.endsWith('.ppt')) type = 'slide';
    else if (file.name.endsWith('.pdf')) type = 'pdf';
  }

  const modified = file.server_modified ? new Date(file.server_modified) : new Date();
  const bytes = file.size || 0;
  const sizeStr = bytes > 0 ? (bytes > 1048576 ? `${(bytes / 1048576).toFixed(1)} MB` : `${(bytes / 1024).toFixed(0)} KB`) : '—';

  return {
    id: `dropbox_${file.id || file.path_lower}`,
    cloudFileId: file.id,
    name: file.name,
    type,
    owner: 'Dropbox',
    isOwner: true,
    lastModified: modified.toLocaleDateString(),
    lastModifiedTimestamp: modified.getTime(),
    lastModifiedBy: 'Dropbox',
    fileSize: sizeStr,
    fileSizeBytes: bytes,
    isStarred: false,
    isTrashed: false,
    folderId: null,
    isCloudSynced: true,
    storageLocation: 'cloud',
    provider: 'dropbox',
  };
}

export function convertTeraBoxFileToDriveItem(file: any): DriveItem {
  const isFolder = file.isdir === 1 || file.is_dir === 1;
  let type: DriveItemType = isFolder ? 'folder' : 'doc';
  const name = file.server_filename || file.name || 'Untitled';
  if (!isFolder) {
    if (name.endsWith('.xlsx') || name.endsWith('.xls') || name.endsWith('.csv')) type = 'sheet';
    else if (name.endsWith('.pptx') || name.endsWith('.ppt')) type = 'slide';
    else if (name.endsWith('.pdf')) type = 'pdf';
  }
  const bytes = file.size || 0;
  const sizeStr = bytes > 0 ? (bytes > 1048576 ? `${(bytes / 1048576).toFixed(1)} MB` : `${(bytes / 1024).toFixed(0)} KB`) : '—';
  const modTime = file.server_mtime ? file.server_mtime * 1000 : Date.now();

  return {
    id: `terabox_${file.fs_id || file.id || Date.now()}`,
    cloudFileId: String(file.fs_id || file.id || ''),
    name,
    type,
    owner: 'TeraBox (1TB)',
    isOwner: true,
    lastModified: new Date(modTime).toLocaleDateString(),
    lastModifiedTimestamp: modTime,
    lastModifiedBy: 'TeraBox',
    fileSize: sizeStr,
    fileSizeBytes: bytes,
    isStarred: false,
    isTrashed: false,
    folderId: null,
    isCloudSynced: true,
    storageLocation: 'cloud',
    provider: 'terabox',
  };
}

export function convertBoxFileToDriveItem(file: any): DriveItem {
  const isFolder = file.type === 'folder';
  let type: DriveItemType = isFolder ? 'folder' : 'doc';
  const name = file.name || 'Untitled';
  if (!isFolder) {
    if (name.endsWith('.xlsx') || name.endsWith('.xls') || name.endsWith('.csv')) type = 'sheet';
    else if (name.endsWith('.pptx') || name.endsWith('.ppt')) type = 'slide';
    else if (name.endsWith('.pdf')) type = 'pdf';
  }
  const bytes = file.size || 0;
  const sizeStr = bytes > 0 ? (bytes > 1048576 ? `${(bytes / 1048576).toFixed(1)} MB` : `${(bytes / 1024).toFixed(0)} KB`) : '—';
  const modified = file.modified_at ? new Date(file.modified_at) : new Date();

  return {
    id: `box_${file.id}`,
    cloudFileId: file.id,
    name,
    type,
    owner: 'Box',
    isOwner: true,
    lastModified: modified.toLocaleDateString(),
    lastModifiedTimestamp: modified.getTime(),
    lastModifiedBy: 'Box',
    fileSize: sizeStr,
    fileSizeBytes: bytes,
    isStarred: false,
    isTrashed: false,
    folderId: file.parent?.id || null,
    isCloudSynced: true,
    storageLocation: 'cloud',
    provider: 'box',
  };
}

export function convertPCloudFileToDriveItem(file: any): DriveItem {
  const isFolder = file.isfolder === true || file.folderid !== undefined;
  let type: DriveItemType = isFolder ? 'folder' : 'doc';
  const name = file.name || 'Untitled';
  if (!isFolder) {
    if (name.endsWith('.xlsx') || name.endsWith('.xls') || name.endsWith('.csv')) type = 'sheet';
    else if (name.endsWith('.pptx') || name.endsWith('.ppt')) type = 'slide';
    else if (name.endsWith('.pdf')) type = 'pdf';
  }
  const bytes = file.size || 0;
  const sizeStr = bytes > 0 ? (bytes > 1048576 ? `${(bytes / 1048576).toFixed(1)} MB` : `${(bytes / 1024).toFixed(0)} KB`) : '—';
  const modified = file.modified ? new Date(file.modified) : new Date();

  return {
    id: `pcloud_${file.fileid || file.folderid || Date.now()}`,
    cloudFileId: String(file.fileid || file.folderid || ''),
    name,
    type,
    owner: 'pCloud',
    isOwner: true,
    lastModified: modified.toLocaleDateString(),
    lastModifiedTimestamp: modified.getTime(),
    lastModifiedBy: 'pCloud',
    fileSize: sizeStr,
    fileSizeBytes: bytes,
    isStarred: false,
    isTrashed: false,
    folderId: null,
    isCloudSynced: true,
    storageLocation: 'cloud',
    provider: 'pcloud',
  };
}

