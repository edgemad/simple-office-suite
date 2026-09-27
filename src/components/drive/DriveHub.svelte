<script lang="ts">
  import { createEventDispatcher, onMount } from 'svelte';
  import type { WorkspaceMode } from '../../types';
  import {
    loadDriveItems,
    saveDriveItems,
    DEFAULT_LOCAL_ITEMS,
    convertGoogleDriveFileToDriveItem,
    convertOneDriveFileToDriveItem,
    convertDropboxFileToDriveItem,
    convertTeraBoxFileToDriveItem,
    convertBoxFileToDriveItem,
    convertPCloudFileToDriveItem,
    type DriveItem,
    type DriveItemType,
  } from './driveData';
  import {
    activeAccount,
    storageTarget,
    setStorageTarget,
    activeCloudProvider,
    setActiveCloudProvider,
    cloudAccounts,
    isNetworkOnline,
    getLiveGoogleDriveFiles,
    getLiveOneDriveFiles,
    getLiveDropboxFiles,
    getLiveTeraBoxFiles,
    getLiveBoxFiles,
    getLivePCloudFiles
  } from '../../lib/googleSync';
  import GoogleSyncModal from '../layout/GoogleSyncModal.svelte';
  import {
    uploadToDrive,
    createDriveFolder,
    trashDriveFile,
    downloadDriveFile
  } from '../../lib/googleDriveClient';
  import {
    Search,
    Plus,
    FolderPlus,
    Folder,
    FolderOpen,
    Upload,
    HardDrive,
    Laptop,
    Users,
    Clock,
    Star,
    AlertOctagon,
    Trash2,
    Database,
    Grid,
    List,
    ArrowUpDown,
    ArrowUp,
    ArrowDown,
    MoreVertical,
    FileText,
    Sheet,
    Presentation,
    FileCheck,
    File,
    Download,
    Edit3,
    Copy,
    RotateCcw,
    ExternalLink,
    Check,
    X,
    Info,
    ChevronRight,
    ChevronDown,
    SlidersHorizontal,
    Cloud,
    CheckCircle2,
    Share2,
    Eye,
    Tag,
    RefreshCw
  } from 'lucide-svelte';

  export let activeWorkspaceDocIds: string[] = [];

  const dispatch = createEventDispatcher<{
    openDocument: {
      item: DriveItem;
      mode: WorkspaceMode;
      documentId?: string;
      title: string;
    };
    newDoc: {
      type: 'writer' | 'sheets' | 'slides' | 'pdf';
      title?: string;
    };
  }>();

  // Navigation tabs
  type NavSection = 'my_drive' | 'computers' | 'shared' | 'recent' | 'starred' | 'spam' | 'trash';
  let activeSection: NavSection = 'my_drive';

  // State
  let items: DriveItem[] = [];
  let searchQuery: string = '';
  let selectedTypeFilter: string = 'all'; // all, doc, sheet, slide, form, pdf, folder
  let selectedPeopleFilter: string = 'all'; // all, me, not_me
  let selectedModifiedFilter: string = 'all'; // all, today, 7days, 30days, earlier
  let viewMode: 'grid' | 'list' = 'grid';

  // Sorting
  type SortField = 'name' | 'owner' | 'lastModified' | 'fileSize';
  let sortField: SortField = 'lastModified';
  let sortAscending: boolean = false;

  // Selection & UI
  let selectedItemId: string | null = null;
  let showNewMenu: boolean = false;
  let showTypeMenu: boolean = false;
  let showPeopleMenu: boolean = false;
  let showModifiedMenu: boolean = false;
  let showDetailsSidebar: boolean = true;
  let activeFolderId: string | null = null; // null = root

  // Modals & Context Menus
  let showNewFolderModal: boolean = false;
  let newFolderName: string = 'Untitled Folder';
  let showRenameModal: boolean = false;
  let renameItemId: string | null = null;
  let renameItemName: string = '';
  let contextMenuVisible: boolean = false;
  let contextMenuPos = { x: 0, y: 0 };
  let contextMenuItem: DriveItem | null = null;

  // Snackbar Notification
  let snackbarMessage: string | null = null;
  let snackbarTimeout: any = null;

  function showNotification(msg: string) {
    snackbarMessage = msg;
    if (snackbarTimeout) clearTimeout(snackbarTimeout);
    snackbarTimeout = setTimeout(() => {
      snackbarMessage = null;
    }, 3500);
  }

  let isFetchingCloudFiles: boolean = false;
  let showCloudModal: boolean = false;
  let lastSyncErrorNotice: string | null = null;
  let lastSyncSuccessNotice: string | null = null;

  $: isCloudMode = $storageTarget === 'cloud';
  $: cloudProviderName =
    $activeCloudProvider === 'terabox' ? 'TeraBox (1TB)' :
    $activeCloudProvider === 'box' ? 'Box' :
    $activeCloudProvider === 'pcloud' ? 'pCloud' :
    $activeCloudProvider === 'mega' ? 'Mega.nz' :
    $activeCloudProvider === 'onedrive' ? 'OneDrive' :
    $activeCloudProvider === 'dropbox' ? 'Dropbox' :
    $activeCloudProvider === 'webdav' ? 'WebDAV' :
    $activeCloudProvider === 'local_folder' ? 'Folder Sync' : 'Google Drive';

  async function fetchLiveGoogleDrive() {
    lastSyncErrorNotice = null;
    lastSyncSuccessNotice = null;

    if ($activeCloudProvider === 'google_drive') {
      if (!$activeAccount?.accessToken) {
        if (isCloudMode) {
          lastSyncErrorNotice = 'No Google Account is linked yet. Click "Link Cloud Drive" to connect.';
        }
        return;
      }
      isFetchingCloudFiles = true;
      try {
        const gFiles = await getLiveGoogleDriveFiles(activeFolderId || undefined);
        const cloudItems = gFiles.map(convertGoogleDriveFileToDriveItem);
        // Keep local items
        const localItems = items.filter((i) => i.storageLocation !== 'cloud');
        items = [...cloudItems, ...localItems];
        saveDriveItems(items);
        if (cloudItems.length === 0) {
          lastSyncSuccessNotice = `Google Drive connected (${$activeAccount.email}), but 0 files found in root. Note: if authorized in Playground using 'drive.file', Google only returns files created by this app. To see all existing files, authorize with full 'drive' scope.`;
        } else {
          lastSyncSuccessNotice = `Retrieved ${cloudItems.length} file(s) from Google Drive.`;
          showNotification(`Synced ${cloudItems.length} file(s) from Google Drive`);
        }
      } catch (err: any) {
        console.warn('Google Drive fetch error:', err);
        lastSyncErrorNotice = `Google Drive Sync Notice: ${err.message || 'Failed to list files'}. Please verify your access token.`;
      } finally {
        isFetchingCloudFiles = false;
      }
    } else if ($activeCloudProvider === 'terabox') {
      const acc = $cloudAccounts.find((c) => c.provider === 'terabox');
      if (!acc || !acc.accessToken) {
        if (isCloudMode) lastSyncErrorNotice = 'No TeraBox account linked yet.';
        return;
      }
      isFetchingCloudFiles = true;
      try {
        const tFiles = await getLiveTeraBoxFiles(acc.accessToken);
        const cloudItems = tFiles.map(convertTeraBoxFileToDriveItem);
        const localItems = items.filter((i) => i.storageLocation !== 'cloud');
        items = [...cloudItems, ...localItems];
        saveDriveItems(items);
        showNotification(`Synced ${cloudItems.length} file(s) from TeraBox`);
      } catch (err: any) {
        lastSyncErrorNotice = `TeraBox Sync Notice: ${err.message}`;
      } finally {
        isFetchingCloudFiles = false;
      }
    } else if ($activeCloudProvider === 'box') {
      const acc = $cloudAccounts.find((c) => c.provider === 'box');
      if (!acc || !acc.accessToken) {
        if (isCloudMode) lastSyncErrorNotice = 'No Box account linked yet.';
        return;
      }
      isFetchingCloudFiles = true;
      try {
        const bFiles = await getLiveBoxFiles(acc.accessToken);
        const cloudItems = bFiles.map(convertBoxFileToDriveItem);
        const localItems = items.filter((i) => i.storageLocation !== 'cloud');
        items = [...cloudItems, ...localItems];
        saveDriveItems(items);
        showNotification(`Synced ${cloudItems.length} file(s) from Box`);
      } catch (err: any) {
        lastSyncErrorNotice = `Box Sync Notice: ${err.message}`;
      } finally {
        isFetchingCloudFiles = false;
      }
    } else if ($activeCloudProvider === 'pcloud') {
      const acc = $cloudAccounts.find((c) => c.provider === 'pcloud');
      if (!acc || !acc.accessToken) {
        if (isCloudMode) lastSyncErrorNotice = 'No pCloud account linked yet.';
        return;
      }
      isFetchingCloudFiles = true;
      try {
        const pFiles = await getLivePCloudFiles(acc.accessToken);
        const cloudItems = pFiles.map(convertPCloudFileToDriveItem);
        const localItems = items.filter((i) => i.storageLocation !== 'cloud');
        items = [...cloudItems, ...localItems];
        saveDriveItems(items);
        showNotification(`Synced ${cloudItems.length} file(s) from pCloud`);
      } catch (err: any) {
        lastSyncErrorNotice = `pCloud Sync Notice: ${err.message}`;
      } finally {
        isFetchingCloudFiles = false;
      }
    } else if ($activeCloudProvider === 'onedrive') {
      const acc = $cloudAccounts.find((c) => c.provider === 'onedrive');
      if (!acc || !acc.accessToken) {
        if (isCloudMode) lastSyncErrorNotice = 'No OneDrive account linked yet.';
        return;
      }
      isFetchingCloudFiles = true;
      try {
        const oFiles = await getLiveOneDriveFiles(acc.accessToken);
        const cloudItems = oFiles.map(convertOneDriveFileToDriveItem);
        const localItems = items.filter((i) => i.storageLocation !== 'cloud');
        items = [...cloudItems, ...localItems];
        saveDriveItems(items);
        showNotification(`Synced ${cloudItems.length} file(s) from OneDrive`);
      } catch (err: any) {
        lastSyncErrorNotice = `OneDrive Sync Notice: ${err.message}`;
      } finally {
        isFetchingCloudFiles = false;
      }
    } else if ($activeCloudProvider === 'dropbox') {
      const acc = $cloudAccounts.find((c) => c.provider === 'dropbox');
      if (!acc || !acc.accessToken) {
        if (isCloudMode) lastSyncErrorNotice = 'No Dropbox account linked yet.';
        return;
      }
      isFetchingCloudFiles = true;
      try {
        const dFiles = await getLiveDropboxFiles(acc.accessToken);
        const cloudItems = dFiles.map(convertDropboxFileToDriveItem);
        const localItems = items.filter((i) => i.storageLocation !== 'cloud');
        items = [...cloudItems, ...localItems];
        saveDriveItems(items);
        showNotification(`Synced ${cloudItems.length} file(s) from Dropbox`);
      } catch (err: any) {
        lastSyncErrorNotice = `Dropbox Sync Notice: ${err.message}`;
      } finally {
        isFetchingCloudFiles = false;
      }
    }
  }

  $: if ($activeAccount?.accessToken && isCloudMode) {
    fetchLiveGoogleDrive();
  }

  onMount(() => {
    items = loadDriveItems();
    if ($activeAccount?.accessToken && isCloudMode) {
      fetchLiveGoogleDrive();
    }
  });

  function updateItemsAndSave(newItems: DriveItem[]) {
    items = newItems;
    saveDriveItems(items);
  }

  // --- Filtering by Storage Location (Local vs Cloud) ---
  $: activeStorageItems = items.filter((item) => {
    if (isCloudMode) {
      return item.storageLocation === 'cloud';
    } else {
      return item.storageLocation === 'local' || !item.storageLocation;
    }
  });

  // --- Filtering & Sorting Computed Data ---
  $: filteredItems = activeStorageItems.filter((item) => {
    // 1. Navigation Section Filter
    if (activeSection === 'my_drive') {
      if (item.isTrashed || item.isSpam) return false;
      if (activeFolderId) {
        if (item.folderId !== activeFolderId) return false;
      } else {
        if (item.folderId) return false; // root only
      }
    } else if (activeSection === 'computers') {
      if (item.isTrashed || item.isSpam) return false;
      return item.tags?.includes('Computer') || item.type === 'folder';
    } else if (activeSection === 'shared') {
      if (item.isTrashed || item.isSpam) return false;
      return !item.isOwner;
    } else if (activeSection === 'recent') {
      if (item.isTrashed || item.isSpam) return false;
      return true; // will sort by recency
    } else if (activeSection === 'starred') {
      if (item.isTrashed || item.isSpam) return false;
      return item.isStarred;
    } else if (activeSection === 'spam') {
      return item.isSpam && !item.isTrashed;
    } else if (activeSection === 'trash') {
      return item.isTrashed;
    }

    // 2. Search Query Filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      const matchName = item.name.toLowerCase().includes(q);
      const matchOwner = item.owner.toLowerCase().includes(q);
      const matchSnippet = item.contentSnippet?.toLowerCase().includes(q);
      const matchTags = item.tags?.some((t) => t.toLowerCase().includes(q));
      if (!matchName && !matchOwner && !matchSnippet && !matchTags) return false;
    }

    // 3. Type Filter Chip
    if (selectedTypeFilter !== 'all') {
      if (item.type !== selectedTypeFilter) return false;
    }

    // 4. People Filter Chip
    if (selectedPeopleFilter === 'me') {
      if (!item.isOwner) return false;
    } else if (selectedPeopleFilter === 'not_me') {
      if (item.isOwner) return false;
    }

    // 5. Modified Date Filter Chip
    if (selectedModifiedFilter !== 'all') {
      const now = Date.now();
      const diffMs = now - item.lastModifiedTimestamp;
      const oneDay = 86400000;
      if (selectedModifiedFilter === 'today' && diffMs > oneDay) return false;
      if (selectedModifiedFilter === '7days' && diffMs > 7 * oneDay) return false;
      if (selectedModifiedFilter === '30days' && diffMs > 30 * oneDay) return false;
      if (selectedModifiedFilter === 'earlier' && diffMs <= 30 * oneDay) return false;
    }

    return true;
  });

  // Split into Folders and Files for My Drive view
  $: folderItems = filteredItems.filter((i) => i.type === 'folder');
  $: fileItems = filteredItems.filter((i) => i.type !== 'folder');

  // Sorted items
  $: sortedFiles = [...fileItems].sort((a, b) => {
    let cmp = 0;
    if (sortField === 'name') {
      cmp = a.name.localeCompare(b.name);
    } else if (sortField === 'owner') {
      cmp = a.owner.localeCompare(b.owner);
    } else if (sortField === 'fileSize') {
      cmp = a.fileSizeBytes - b.fileSizeBytes;
    } else {
      cmp = a.lastModifiedTimestamp - b.lastModifiedTimestamp;
    }
    return sortAscending ? cmp : -cmp;
  });

  $: selectedItem = items.find((i) => i.id === selectedItemId) || null;

  $: activeFolder = items.find((i) => i.id === activeFolderId && i.type === 'folder') || null;

  // Has active filter chips
  $: hasActiveFilters =
    selectedTypeFilter !== 'all' ||
    selectedPeopleFilter !== 'all' ||
    selectedModifiedFilter !== 'all' ||
    searchQuery.trim().length > 0;

  function clearAllFilters() {
    selectedTypeFilter = 'all';
    selectedPeopleFilter = 'all';
    selectedModifiedFilter = 'all';
    searchQuery = '';
    showTypeMenu = false;
    showPeopleMenu = false;
    showModifiedMenu = false;
  }

  // --- File Actions ---
  function handleItemClick(item: DriveItem) {
    selectedItemId = item.id;
  }

  function handleItemDoubleClick(item: DriveItem) {
    openItem(item);
  }

  function openItem(item: DriveItem) {
    if (item.type === 'folder') {
      activeFolderId = item.id;
      selectedItemId = null;
      return;
    }

    let mode: WorkspaceMode = 'writer';
    if (item.type === 'sheet') mode = 'sheets';
    else if (item.type === 'slide') mode = 'slides';
    else if (item.type === 'pdf' || item.type === 'form') mode = 'pdf';

    dispatch('openDocument', {
      item,
      mode,
      documentId: item.workspaceDocId || item.id,
      title: item.name,
    });
    showNotification(`Opened "${item.name}" in Google ${getAppLabel(item.type)}`);
  }

  function toggleStar(item: DriveItem, e?: Event) {
    if (e) e.stopPropagation();
    const updated = items.map((i) => (i.id === item.id ? { ...i, isStarred: !i.isStarred } : i));
    updateItemsAndSave(updated);
    showNotification(item.isStarred ? `Removed "${item.name}" from Starred` : `Added "${item.name}" to Starred`);
  }

  function handleCreateDocument(type: DriveItemType) {
    showNewMenu = false;
    const timestamp = Date.now();
    let name = 'Untitled Document';
    let size = '12 KB';
    let sizeBytes = 12000;

    if (type === 'sheet') {
      name = 'Untitled Spreadsheet';
      size = '28 KB';
      sizeBytes = 28000;
    } else if (type === 'slide') {
      name = 'Untitled Presentation';
      size = '1.2 MB';
      sizeBytes = 1200000;
    } else if (type === 'form') {
      name = 'Untitled Form';
      size = '16 KB';
      sizeBytes = 16000;
    } else if (type === 'pdf') {
      name = 'New PDF Document.pdf';
      size = '45 KB';
      sizeBytes = 45000;
    }

    const newItem: DriveItem = {
      id: `${isCloudMode ? 'cloud' : 'local'}_${type}_${timestamp}`,
      name,
      type,
      owner: isCloudMode ? ($activeAccount?.name || 'Cloud Drive') : 'Me',
      isOwner: true,
      lastModified: 'Just now',
      lastModifiedTimestamp: timestamp,
      lastModifiedBy: 'Me',
      fileSize: size,
      fileSizeBytes: sizeBytes,
      isStarred: false,
      isTrashed: false,
      folderId: activeFolderId,
      contentSnippet: `New ${isCloudMode ? 'cloud' : 'local offline'} document...`,
      storageLocation: isCloudMode ? 'cloud' : 'local',
      provider: isCloudMode ? $activeCloudProvider : undefined,
    };

    updateItemsAndSave([newItem, ...items]);
    selectedItemId = newItem.id;

    let appMode: WorkspaceMode = 'writer';
    if (type === 'sheet') appMode = 'sheets';
    else if (type === 'slide') appMode = 'slides';
    else if (type === 'pdf' || type === 'form') appMode = 'pdf';

    dispatch('newDoc', { type: appMode, title: name });
    dispatch('openDocument', { item: newItem, mode: appMode, title: name });
    showNotification(`Created new Google ${getAppLabel(type)}`);
  }

  async function handleCreateFolder() {
    if (!newFolderName.trim()) return;
    const timestamp = Date.now();

    if ($activeAccount?.accessToken) {
      try {
        const cloudFolder = await createDriveFolder($activeAccount.accessToken, newFolderName.trim(), activeFolderId || undefined);
        const folderItem = convertGoogleDriveFileToDriveItem(cloudFolder);
        updateItemsAndSave([folderItem, ...items]);
        showNewFolderModal = false;
        newFolderName = 'Untitled Folder';
        selectedItemId = folderItem.id;
        showNotification(`Folder "${folderItem.name}" created in Google Drive`);
        return;
      } catch (err: any) {
        console.warn('Failed to create folder in Google Drive:', err);
      }
    }

    const newFolder: DriveItem = {
      id: `folder_${timestamp}`,
      name: newFolderName.trim(),
      type: 'folder',
      owner: 'Me',
      isOwner: true,
      lastModified: 'Just now',
      lastModifiedTimestamp: timestamp,
      lastModifiedBy: 'Me',
      fileSize: '—',
      fileSizeBytes: 0,
      isStarred: false,
      isTrashed: false,
      folderId: activeFolderId,
      thumbnailColor: '#4285F4',
    };

    updateItemsAndSave([newFolder, ...items]);
    showNewFolderModal = false;
    newFolderName = 'Untitled Folder';
    selectedItemId = newFolder.id;
    showNotification(`Folder "${newFolder.name}" created`);
  }

  function handleMakeCopy(item: DriveItem) {
    const timestamp = Date.now();
    const copyItem: DriveItem = {
      ...item,
      id: `copy_${timestamp}_${item.id}`,
      name: `Copy of ${item.name}`,
      lastModified: 'Just now',
      lastModifiedTimestamp: timestamp,
      lastModifiedBy: 'Me',
      isOwner: true,
      owner: 'Me',
      isStarred: false,
    };
    updateItemsAndSave([copyItem, ...items]);
    selectedItemId = copyItem.id;
    showNotification(`Created copy "${copyItem.name}"`);
  }

  function openRenameDialog(item: DriveItem) {
    renameItemId = item.id;
    renameItemName = item.name;
    showRenameModal = true;
  }

  function handleCommitRename() {
    if (!renameItemId || !renameItemName.trim()) return;
    const updated = items.map((i) =>
      i.id === renameItemId ? { ...i, name: renameItemName.trim(), lastModified: 'Just now', lastModifiedTimestamp: Date.now() } : i
    );
    updateItemsAndSave(updated);
    showRenameModal = false;
    showNotification(`Renamed to "${renameItemName.trim()}"`);
    renameItemId = null;
  }

  function handleMoveToTrash(item: DriveItem) {
    if (item.cloudFileId && $activeAccount?.accessToken) {
      trashDriveFile($activeAccount.accessToken, item.cloudFileId).catch((err) => {
        console.warn('Failed to trash file in Google Drive:', err);
      });
    }
    const updated = items.map((i) => (i.id === item.id ? { ...i, isTrashed: true } : i));
    updateItemsAndSave(updated);
    if (selectedItemId === item.id) selectedItemId = null;
    showNotification(`Moved "${item.name}" to Trash`);
  }

  function handleRestoreFromTrash(item: DriveItem) {
    const updated = items.map((i) => (i.id === item.id ? { ...i, isTrashed: false } : i));
    updateItemsAndSave(updated);
    if (selectedItemId === item.id) selectedItemId = null;
    showNotification(`Restored "${item.name}" from Trash`);
  }

  function handleDeleteForever(item: DriveItem) {
    if (!confirm(`Delete "${item.name}" forever? This action cannot be undone.`)) return;
    const updated = items.filter((i) => i.id !== item.id);
    updateItemsAndSave(updated);
    if (selectedItemId === item.id) selectedItemId = null;
    showNotification(`Permanently deleted "${item.name}"`);
  }

  function handleEmptyTrash() {
    if (!confirm('Empty all items from Trash? This cannot be undone.')) return;
    const updated = items.filter((i) => !i.isTrashed);
    updateItemsAndSave(updated);
    selectedItemId = null;
    showNotification('Trash emptied successfully');
  }

  async function handleBackupToCloud(item: DriveItem) {
    if (!$activeAccount?.accessToken) {
      showCloudModal = true;
      return;
    }
    try {
      showNotification(`Uploading "${item.name}" to Google Drive...`);
      const ext = item.type === 'sheet' ? 'xlsx' : item.type === 'slide' ? 'pptx' : 'docx';
      const cloudFile = await uploadToDrive($activeAccount.accessToken, {
        name: item.name.includes('.') ? item.name : `${item.name}.${ext}`,
        mimeType: item.type === 'sheet' ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        content: item.contentSnippet || 'Simple Office Document content',
      });
      const cloudItem = convertGoogleDriveFileToDriveItem(cloudFile);
      updateItemsAndSave([cloudItem, ...items]);
      showNotification(`Uploaded "${item.name}" to Google Drive successfully!`);
    } catch (err: any) {
      showNotification(`Upload failed: ${err.message}`);
    }
  }

  function handleSaveToLocal(item: DriveItem) {
    const timestamp = Date.now();
    const localCopy: DriveItem = {
      ...item,
      id: `local_copy_${timestamp}_${item.id}`,
      name: item.name,
      storageLocation: 'local',
      cloudFileId: undefined,
      cloudWebViewLink: undefined,
      isCloudSynced: false,
      owner: 'Me',
      lastModified: 'Just now',
      lastModifiedTimestamp: timestamp,
    };
    updateItemsAndSave([localCopy, ...items]);
    showNotification(`Saved local copy of "${item.name}" to Local Storage`);
  }

  async function handleDownload(item: DriveItem) {
    if (item.cloudFileId && $activeAccount?.accessToken) {
      try {
        showNotification(`Downloading "${item.name}" from Google Drive...`);
        const content = await downloadDriveFile($activeAccount.accessToken, item.cloudFileId);
        const blob = new Blob([content], { type: 'application/octet-stream' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = item.name;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        showNotification(`Downloaded "${item.name}"`);
        return;
      } catch (err: any) {
        console.warn('Google Drive download fallback:', err);
      }
    }

    const blob = new Blob([item.contentSnippet || 'Simple Office Document content'], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = item.name.includes('.') ? item.name : `${item.name}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showNotification(`Downloaded "${item.name}"`);
  }

  function handleFileUpload() {
    showNewMenu = false;
    const input = document.createElement('input');
    input.type = 'file';
    input.multiple = true;
    input.onchange = async (e: any) => {
      const files: FileList = e.target.files;
      if (!files || files.length === 0) return;
      const newDriveFiles: DriveItem[] = [];
      for (let i = 0; i < files.length; i++) {
        const f = files[i];
        const ext = f.name.split('.').pop()?.toLowerCase() || '';
        let type: DriveItemType = 'doc';
        if (['xlsx', 'xls', 'csv'].includes(ext)) type = 'sheet';
        else if (['pptx', 'ppt', 'odp'].includes(ext)) type = 'slide';
        else if (ext === 'pdf') type = 'pdf';

        const sizeFormatted =
          f.size > 1048576
            ? `${(f.size / 1048576).toFixed(1)} MB`
            : `${Math.round(f.size / 1024)} KB`;

        if ($activeAccount?.accessToken) {
          try {
            const content = await f.text();
            const cloudFile = await uploadToDrive($activeAccount.accessToken, {
              name: f.name,
              mimeType: f.type || 'application/octet-stream',
              content,
              parentId: activeFolderId || undefined,
            });
            newDriveFiles.push(convertGoogleDriveFileToDriveItem(cloudFile));
            continue;
          } catch (err: any) {
            console.error('Failed to upload directly to Google Drive:', err);
          }
        }

        newDriveFiles.push({
          id: `upload_${Date.now()}_${i}`,
          name: f.name,
          type,
          owner: 'Me',
          isOwner: true,
          lastModified: 'Just now',
          lastModifiedTimestamp: Date.now(),
          lastModifiedBy: 'Me',
          fileSize: sizeFormatted,
          fileSizeBytes: f.size,
          isStarred: false,
          isTrashed: false,
          folderId: activeFolderId,
          contentSnippet: `Imported file ${f.name} (${sizeFormatted})`,
        });
      }
      updateItemsAndSave([...newDriveFiles, ...items]);
      showNotification(`Imported ${files.length} file(s)`);
    };
    input.click();
  }

  // Right-click context menu
  function handleContextMenu(item: DriveItem, e: MouseEvent) {
    e.preventDefault();
    selectedItemId = item.id;
    contextMenuItem = item;
    contextMenuPos = { x: e.clientX, y: e.clientY };
    contextMenuVisible = true;
  }

  function closeContextMenu() {
    contextMenuVisible = false;
    contextMenuItem = null;
  }

  function handleSort(field: SortField) {
    if (sortField === field) {
      sortAscending = !sortAscending;
    } else {
      sortField = field;
      sortAscending = true;
    }
  }

  function getAppLabel(type: DriveItemType): string {
    if (type === 'doc') return 'Docs';
    if (type === 'sheet') return 'Sheets';
    if (type === 'slide') return 'Slides';
    if (type === 'form') return 'Forms';
    if (type === 'pdf') return 'PDF';
    return 'Folder';
  }

  function getSectionTitle(section: NavSection): string {
    if (section === 'my_drive') return 'My Drive';
    if (section === 'computers') return 'Computers';
    if (section === 'shared') return 'Shared with me';
    if (section === 'recent') return 'Recent';
    if (section === 'starred') return 'Starred';
    if (section === 'spam') return 'Spam';
    return 'Trash';
  }
</script>

<svelte:window
  on:click={() => {
    showNewMenu = false;
    showTypeMenu = false;
    showPeopleMenu = false;
    showModifiedMenu = false;
    closeContextMenu();
  }}
/>

<div class="h-full w-full flex flex-col bg-[#F8FAFD] dark:bg-[#131314] text-slate-800 dark:text-slate-200 select-none overflow-hidden font-sans">
  <!-- TOP APP BAR -->
  <header class="h-16 px-5 border-b border-slate-200/80 dark:border-slate-800/80 bg-white/80 dark:bg-[#1E1F20]/80 backdrop-blur-md flex items-center justify-between shrink-0 z-20 gap-3">
    <!-- Left: Files Brand Logo & Title -->
    <div class="flex items-center space-x-3 shrink-0">
      <!-- svelte-ignore a11y_click_events_have_key_events -->
      <!-- svelte-ignore a11y_no_static_element_interactions -->
      <div class="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-xs cursor-pointer hover:bg-blue-700 transition-colors" on:click={() => { activeSection = 'my_drive'; activeFolderId = null; }}>
        {#if isCloudMode}
          <Cloud size={20} />
        {:else}
          <HardDrive size={20} />
        {/if}
      </div>

      <div class="flex items-baseline space-x-1.5">
        <span class="text-xl font-medium tracking-tight text-slate-700 dark:text-slate-100">
          Files
        </span>
        <span class="text-[10px] font-bold uppercase tracking-wider {isCloudMode ? 'text-blue-700 bg-blue-100 dark:bg-blue-900/60' : 'text-emerald-700 bg-emerald-100 dark:bg-emerald-950/60'} px-2 py-0.5 rounded-full">
          {isCloudMode ? (cloudProviderName + ' Synced') : 'Local Storage'}
        </span>
      </div>
    </div>

    <!-- Center Left: Storage Switcher (Local vs Cloud) -->
    <div class="flex items-center bg-slate-200/80 dark:bg-slate-800 p-0.5 rounded-xl border border-slate-300/60 dark:border-slate-700/60 text-xs font-semibold shrink-0">
      <button
        type="button"
        class="flex items-center space-x-1.5 px-3 py-1 rounded-lg transition-all {!isCloudMode ? 'bg-white dark:bg-slate-700 text-blue-700 dark:text-blue-300 shadow-2xs font-bold' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'}"
        on:click={() => setStorageTarget('local')}
        title="View and manage local offline files stored on this computer"
      >
        <HardDrive size={13} />
        <span>Local Storage</span>
      </button>
      <button
        type="button"
        class="flex items-center space-x-1.5 px-3 py-1 rounded-lg transition-all {isCloudMode ? 'bg-blue-600 text-white shadow-2xs font-bold' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'}"
        on:click={() => {
          if (!$activeAccount && $cloudAccounts.length === 0) {
            showCloudModal = true;
          } else {
            setStorageTarget('cloud');
            fetchLiveGoogleDrive();
          }
        }}
        title="View and synchronize online cloud drive files (Google Drive, OneDrive, Dropbox)"
      >
        <Cloud size={13} />
        <span>Cloud Drive</span>
      </button>
    </div>

    <!-- Center: Search in Files Bar with Instant Filtering -->
    <div class="flex-1 max-w-xl px-2">
      <div class="relative flex items-center">
        <div class="absolute left-3.5 text-slate-500 pointer-events-none flex items-center">
          <Search size={18} />
        </div>
        <input
          type="text"
          bind:value={searchQuery}
          placeholder={isCloudMode ? `Search in ${cloudProviderName}...` : "Search local files..."}
          class="w-full bg-[#E9EEF6] dark:bg-[#282A2C] hover:bg-[#E1E7F0] dark:hover:bg-[#313335] focus:bg-white dark:focus:bg-[#1E1F20] text-slate-800 dark:text-slate-100 pl-11 pr-20 py-2.5 rounded-full text-sm outline-none transition-all shadow-inner focus:shadow-md border border-transparent focus:border-blue-500/40"
        />
        <div class="absolute right-3 flex items-center space-x-1">
          {#if searchQuery}
            <button
              class="p-1 rounded-full text-slate-500 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-300/40 dark:hover:bg-slate-700/50 transition-colors"
              on:click={() => (searchQuery = '')}
              title="Clear search"
            >
              <X size={16} />
            </button>
          {/if}
          <button
            class="p-1.5 rounded-full text-slate-500 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-300/40 dark:hover:bg-slate-700/50 transition-colors"
            title="Search options"
            on:click|stopPropagation={() => (showTypeMenu = !showTypeMenu)}
          >
            <SlidersHorizontal size={15} />
          </button>
        </div>
      </div>
    </div>

    <!-- Right: Status Pill & Actions -->
    <div class="flex items-center space-x-2 shrink-0">
      {#if isCloudMode}
        <button
          class="p-2 rounded-full text-slate-600 dark:text-slate-300 hover:bg-slate-200/70 dark:hover:bg-slate-800 transition-colors"
          on:click={fetchLiveGoogleDrive}
          title={`Refresh from ${cloudProviderName}`}
          disabled={isFetchingCloudFiles}
        >
          <RefreshCw size={17} class={isFetchingCloudFiles ? 'animate-spin text-blue-600' : ''} />
        </button>
      {/if}

      <div class="hidden sm:flex items-center space-x-1.5 px-3 py-1.5 rounded-full {isCloudMode && $activeAccount?.accessToken ? 'bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200/60 dark:border-emerald-800/40 text-emerald-700 dark:text-emerald-300' : 'bg-blue-50 dark:bg-blue-950/40 border border-blue-200/60 dark:border-blue-800/40 text-blue-700 dark:text-blue-300'} text-xs font-medium">
        <span class="w-2 h-2 rounded-full {isCloudMode && $activeAccount?.accessToken ? 'bg-emerald-500 animate-pulse' : 'bg-blue-500'}"></span>
        <span>{isCloudMode ? ($activeAccount?.accessToken ? `${cloudProviderName} Synced` : 'Cloud Offline') : '100% Offline Ready'}</span>
      </div>

      <!-- Cloud Accounts & Storage Settings Button -->
      <button
        class="p-2 rounded-full text-slate-600 dark:text-slate-300 hover:bg-slate-200/70 dark:hover:bg-slate-800 transition-colors"
        on:click={() => (showCloudModal = true)}
        title="Manage Cloud Storage & Drive Links"
      >
        <Cloud size={18} />
      </button>

      <!-- View Details Sidebar Toggle -->
      <button
        class="p-2 rounded-full text-slate-600 dark:text-slate-300 hover:bg-slate-200/70 dark:hover:bg-slate-800 transition-colors {showDetailsSidebar ? 'bg-blue-100/70 dark:bg-blue-900/40 text-blue-600 dark:text-blue-300' : ''}"
        on:click={() => (showDetailsSidebar = !showDetailsSidebar)}
        title="View details ({showDetailsSidebar ? 'Hide' : 'Show'})"
      >
        <Info size={18} />
      </button>
    </div>
  </header>

  <!-- BODY CONTENT: SIDEBAR + MAIN DRIVE VIEW + DETAILS SIDEBAR -->
  <div class="flex-1 flex overflow-hidden">
    <!-- LEFT SIDEBAR NAVIGATION DRAWER -->
    <aside class="w-64 bg-white/50 dark:bg-[#1E1F20]/50 border-r border-slate-200/80 dark:border-slate-800/80 flex flex-col p-4 shrink-0 select-none justify-between">
      <div class="space-y-4">
        <!-- + New Button -->
        <div class="relative">
          <button
            class="group w-auto min-w-[136px] bg-white dark:bg-[#2B2D30] hover:bg-blue-50 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-100 rounded-2xl px-5 py-3.5 shadow-md hover:shadow-lg border border-slate-200 dark:border-slate-700 flex items-center space-x-3 transition-all active:scale-98"
            on:click|stopPropagation={() => (showNewMenu = !showNewMenu)}
          >
            <div class="w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center shadow-xs">
              <Plus size={16} />
            </div>
            <span class="font-semibold text-sm tracking-tight">New</span>
          </button>

          <!-- + New Dropdown Menu -->
          {#if showNewMenu}
            <!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
            <div
              class="absolute left-0 top-16 z-50 w-64 bg-white dark:bg-[#282A2C] rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 p-2 animate-in fade-in zoom-in-95 duration-100 text-xs"
              on:click|stopPropagation
            >
              <button
                class="w-full flex items-center space-x-3 px-3.5 py-2.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-700/60 text-slate-700 dark:text-slate-200 font-medium transition-colors"
                on:click={() => { showNewMenu = false; showNewFolderModal = true; }}
              >
                <FolderPlus size={18} class="text-slate-500" />
                <span>New folder</span>
              </button>

              <div class="border-t border-slate-200 dark:border-slate-700 my-1"></div>

              <button
                class="w-full flex items-center space-x-3 px-3.5 py-2.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-700/60 text-slate-700 dark:text-slate-200 font-medium transition-colors"
                on:click={handleFileUpload}
              >
                <Upload size={18} class="text-slate-500" />
                <span>File upload</span>
              </button>

              <div class="border-t border-slate-200 dark:border-slate-700 my-1"></div>

              <!-- Document -->
              <button
                class="w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl hover:bg-blue-50 dark:hover:bg-blue-950/40 text-slate-700 dark:text-slate-200 font-medium transition-colors group"
                on:click={() => handleCreateDocument('doc')}
              >
                <div class="flex items-center space-x-3">
                  <div class="w-5 h-5 rounded bg-blue-600 flex items-center justify-center text-white">
                    <FileText size={13} />
                  </div>
                  <span class="group-hover:text-blue-600 dark:group-hover:text-blue-400">New Document</span>
                </div>
                <ChevronRight size={14} class="text-slate-400" />
              </button>

              <!-- Spreadsheet -->
              <button
                class="w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl hover:bg-emerald-50 dark:hover:bg-emerald-950/40 text-slate-700 dark:text-slate-200 font-medium transition-colors group"
                on:click={() => handleCreateDocument('sheet')}
              >
                <div class="flex items-center space-x-3">
                  <div class="w-5 h-5 rounded bg-emerald-600 flex items-center justify-center text-white">
                    <Sheet size={13} />
                  </div>
                  <span class="group-hover:text-emerald-600 dark:group-hover:text-emerald-400">New Spreadsheet</span>
                </div>
                <ChevronRight size={14} class="text-slate-400" />
              </button>

              <!-- Presentation -->
              <button
                class="w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl hover:bg-amber-50 dark:hover:bg-amber-950/40 text-slate-700 dark:text-slate-200 font-medium transition-colors group"
                on:click={() => handleCreateDocument('slide')}
              >
                <div class="flex items-center space-x-3">
                  <div class="w-5 h-5 rounded bg-amber-500 flex items-center justify-center text-white">
                    <Presentation size={13} />
                  </div>
                  <span class="group-hover:text-amber-600 dark:group-hover:text-amber-400">New Presentation</span>
                </div>
                <ChevronRight size={14} class="text-slate-400" />
              </button>

              <!-- Form -->
              <button
                class="w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl hover:bg-purple-50 dark:hover:bg-purple-950/40 text-slate-700 dark:text-slate-200 font-medium transition-colors group"
                on:click={() => handleCreateDocument('form')}
              >
                <div class="flex items-center space-x-3">
                  <div class="w-5 h-5 rounded bg-purple-600 flex items-center justify-center text-white">
                    <FileCheck size={13} />
                  </div>
                  <span class="group-hover:text-purple-600 dark:group-hover:text-purple-400">New Form</span>
                </div>
                <ChevronRight size={14} class="text-slate-400" />
              </button>
            </div>
          {/if}
        </div>

        <!-- Navigation Links (Material 3 rounded pills) -->
        <nav class="space-y-0.5 text-xs font-medium">
          <!-- My Drive -->
          <button
            class="w-full flex items-center space-x-3.5 px-4 py-2.5 rounded-full transition-colors {activeSection === 'my_drive'
              ? 'bg-[#C2E7FF] dark:bg-[#004A77] text-[#001D35] dark:text-[#C2E7FF] font-semibold'
              : 'text-slate-700 dark:text-slate-300 hover:bg-slate-200/60 dark:hover:bg-slate-800'}"
            on:click={() => { activeSection = 'my_drive'; activeFolderId = null; }}
          >
            <HardDrive size={18} class={activeSection === 'my_drive' ? 'text-blue-600 dark:text-blue-300' : 'text-slate-500'} />
            <span class="text-[13px]">My Drive</span>
          </button>

          <!-- Computers -->
          <button
            class="w-full flex items-center space-x-3.5 px-4 py-2.5 rounded-full transition-colors {activeSection === 'computers'
              ? 'bg-[#C2E7FF] dark:bg-[#004A77] text-[#001D35] dark:text-[#C2E7FF] font-semibold'
              : 'text-slate-700 dark:text-slate-300 hover:bg-slate-200/60 dark:hover:bg-slate-800'}"
            on:click={() => { activeSection = 'computers'; activeFolderId = null; }}
          >
            <Laptop size={18} class={activeSection === 'computers' ? 'text-blue-600 dark:text-blue-300' : 'text-slate-500'} />
            <span class="text-[13px]">Computers</span>
          </button>

          <!-- Shared with me -->
          <button
            class="w-full flex items-center space-x-3.5 px-4 py-2.5 rounded-full transition-colors {activeSection === 'shared'
              ? 'bg-[#C2E7FF] dark:bg-[#004A77] text-[#001D35] dark:text-[#C2E7FF] font-semibold'
              : 'text-slate-700 dark:text-slate-300 hover:bg-slate-200/60 dark:hover:bg-slate-800'}"
            on:click={() => { activeSection = 'shared'; activeFolderId = null; }}
          >
            <Users size={18} class={activeSection === 'shared' ? 'text-blue-600 dark:text-blue-300' : 'text-slate-500'} />
            <span class="text-[13px]">Shared with me</span>
          </button>

          <!-- Recent -->
          <button
            class="w-full flex items-center space-x-3.5 px-4 py-2.5 rounded-full transition-colors {activeSection === 'recent'
              ? 'bg-[#C2E7FF] dark:bg-[#004A77] text-[#001D35] dark:text-[#C2E7FF] font-semibold'
              : 'text-slate-700 dark:text-slate-300 hover:bg-slate-200/60 dark:hover:bg-slate-800'}"
            on:click={() => { activeSection = 'recent'; activeFolderId = null; }}
          >
            <Clock size={18} class={activeSection === 'recent' ? 'text-blue-600 dark:text-blue-300' : 'text-slate-500'} />
            <span class="text-[13px]">Recent</span>
          </button>

          <!-- Starred -->
          <button
            class="w-full flex items-center space-x-3.5 px-4 py-2.5 rounded-full transition-colors {activeSection === 'starred'
              ? 'bg-[#C2E7FF] dark:bg-[#004A77] text-[#001D35] dark:text-[#C2E7FF] font-semibold'
              : 'text-slate-700 dark:text-slate-300 hover:bg-slate-200/60 dark:hover:bg-slate-800'}"
            on:click={() => { activeSection = 'starred'; activeFolderId = null; }}
          >
            <Star size={18} class={activeSection === 'starred' ? 'text-amber-500 fill-amber-500' : 'text-slate-500'} />
            <span class="text-[13px]">Starred</span>
          </button>

          <div class="border-t border-slate-200 dark:border-slate-800 my-2"></div>

          <!-- Spam -->
          <button
            class="w-full flex items-center space-x-3.5 px-4 py-2.5 rounded-full transition-colors {activeSection === 'spam'
              ? 'bg-[#C2E7FF] dark:bg-[#004A77] text-[#001D35] dark:text-[#C2E7FF] font-semibold'
              : 'text-slate-700 dark:text-slate-300 hover:bg-slate-200/60 dark:hover:bg-slate-800'}"
            on:click={() => { activeSection = 'spam'; activeFolderId = null; }}
          >
            <AlertOctagon size={18} class={activeSection === 'spam' ? 'text-blue-600 dark:text-blue-300' : 'text-slate-500'} />
            <span class="text-[13px]">Spam</span>
          </button>

          <!-- Trash -->
          <button
            class="w-full flex items-center space-x-3.5 px-4 py-2.5 rounded-full transition-colors {activeSection === 'trash'
              ? 'bg-[#C2E7FF] dark:bg-[#004A77] text-[#001D35] dark:text-[#C2E7FF] font-semibold'
              : 'text-slate-700 dark:text-slate-300 hover:bg-slate-200/60 dark:hover:bg-slate-800'}"
            on:click={() => { activeSection = 'trash'; activeFolderId = null; }}
          >
            <Trash2 size={18} class={activeSection === 'trash' ? 'text-blue-600 dark:text-blue-300' : 'text-slate-500'} />
            <span class="text-[13px]">Trash</span>
          </button>
        </nav>
      </div>

      <!-- Storage Mode & Quota Widget -->
      <div class="pt-4 border-t border-slate-200 dark:border-slate-800 space-y-2">
        <div class="flex items-center justify-between text-slate-700 dark:text-slate-300 text-xs font-medium">
          <div class="flex items-center space-x-2">
            {#if isCloudMode}
              <Cloud size={16} class="text-blue-600 dark:text-blue-400" />
              <span>{cloudProviderName}</span>
            {:else}
              <HardDrive size={16} class="text-emerald-600 dark:text-emerald-400" />
              <span>Local Storage</span>
            {/if}
          </div>
          <button
            class="text-[10px] text-blue-600 dark:text-blue-400 hover:underline font-semibold"
            on:click={() => (showCloudModal = true)}
          >
            Accounts
          </button>
        </div>

        <!-- Quota Progress Bar -->
        <div class="w-full h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
          <div class="h-full bg-blue-600 rounded-full" style="width: {isCloudMode ? Math.min(100, Math.round((($activeAccount?.driveQuotaUsedMb || 0) / ($activeAccount?.driveQuotaTotalMb || 15360)) * 100)) : 10}%;"></div>
        </div>

        <div class="text-[11px] text-slate-500 dark:text-slate-400">
          {#if isCloudMode}
            {($activeAccount?.driveQuotaUsedMb ? ($activeAccount.driveQuotaUsedMb / 1024).toFixed(2) : '0')} GB of {($activeAccount?.driveQuotaTotalMb ? ($activeAccount.driveQuotaTotalMb / 1024).toFixed(1) : '15')} GB used
          {:else}
            Offline On-Device Storage • Mac Local
          {/if}
        </div>

        <button
          class="w-full mt-1 px-3 py-1.5 rounded-full border border-slate-300 dark:border-slate-700 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/40 text-xs font-semibold transition-colors text-center"
          on:click={() => (showCloudModal = true)}
        >
          {isCloudMode ? 'Manage Cloud Drives' : 'Configure Cloud Sync'}
        </button>
      </div>
    </aside>

    <!-- MAIN DRIVE CONTENT VIEW -->
    <main class="flex-1 flex flex-col min-w-0 bg-[#F8FAFD] dark:bg-[#131314] overflow-hidden">
      <!-- FILTER CHIPS & CONTROLS TOOLBAR -->
      <div class="px-6 py-3 border-b border-slate-200/80 dark:border-slate-800/80 flex items-center justify-between gap-4 shrink-0 bg-white/40 dark:bg-[#1E1F20]/40">
        <!-- Left: Material 3 Filter Chips (Type, People, Modified) -->
        <div class="flex items-center space-x-2 overflow-x-auto py-1">
          <!-- Type Filter Chip -->
          <div class="relative">
            <button
              class="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-all {selectedTypeFilter !== 'all'
                ? 'bg-blue-100 dark:bg-blue-900/40 border-blue-400 text-blue-700 dark:text-blue-300'
                : 'border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'}"
              on:click|stopPropagation={() => {
                showTypeMenu = !showTypeMenu;
                showPeopleMenu = false;
                showModifiedMenu = false;
              }}
            >
              <span>Type</span>
              {#if selectedTypeFilter !== 'all'}
                <span class="font-bold">: {getAppLabel(selectedTypeFilter as DriveItemType)}</span>
              {/if}
              <ChevronDown size={14} class="text-slate-400" />
            </button>

            {#if showTypeMenu}
              <!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
              <div
                class="absolute left-0 top-10 z-40 w-48 bg-white dark:bg-[#282A2C] rounded-xl shadow-xl border border-slate-200 dark:border-slate-700 p-1.5 text-xs animate-in fade-in zoom-in-95 duration-75"
                on:click|stopPropagation
              >
                <button
                  class="w-full text-left px-3 py-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 {selectedTypeFilter === 'all' ? 'text-blue-600 font-semibold' : ''}"
                  on:click={() => { selectedTypeFilter = 'all'; showTypeMenu = false; }}
                >
                  All Types
                </button>
                <button
                  class="w-full text-left px-3 py-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center space-x-2 {selectedTypeFilter === 'doc' ? 'text-blue-600 font-semibold' : ''}"
                  on:click={() => { selectedTypeFilter = 'doc'; showTypeMenu = false; }}
                >
                  <FileText size={14} class="text-blue-500" />
                  <span>Documents (Docs)</span>
                </button>
                <button
                  class="w-full text-left px-3 py-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center space-x-2 {selectedTypeFilter === 'sheet' ? 'text-emerald-600 font-semibold' : ''}"
                  on:click={() => { selectedTypeFilter = 'sheet'; showTypeMenu = false; }}
                >
                  <Sheet size={14} class="text-emerald-500" />
                  <span>Spreadsheets (Sheets)</span>
                </button>
                <button
                  class="w-full text-left px-3 py-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center space-x-2 {selectedTypeFilter === 'slide' ? 'text-amber-600 font-semibold' : ''}"
                  on:click={() => { selectedTypeFilter = 'slide'; showTypeMenu = false; }}
                >
                  <Presentation size={14} class="text-amber-500" />
                  <span>Presentations (Slides)</span>
                </button>
                <button
                  class="w-full text-left px-3 py-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center space-x-2 {selectedTypeFilter === 'form' ? 'text-purple-600 font-semibold' : ''}"
                  on:click={() => { selectedTypeFilter = 'form'; showTypeMenu = false; }}
                >
                  <FileCheck size={14} class="text-purple-500" />
                  <span>Forms</span>
                </button>
                <button
                  class="w-full text-left px-3 py-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center space-x-2 {selectedTypeFilter === 'pdf' ? 'text-rose-600 font-semibold' : ''}"
                  on:click={() => { selectedTypeFilter = 'pdf'; showTypeMenu = false; }}
                >
                  <File size={14} class="text-rose-500" />
                  <span>PDFs</span>
                </button>
                <button
                  class="w-full text-left px-3 py-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center space-x-2 {selectedTypeFilter === 'folder' ? 'text-blue-600 font-semibold' : ''}"
                  on:click={() => { selectedTypeFilter = 'folder'; showTypeMenu = false; }}
                >
                  <Folder size={14} class="text-slate-500" />
                  <span>Folders</span>
                </button>
              </div>
            {/if}
          </div>

          <!-- People Filter Chip -->
          <div class="relative">
            <button
              class="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-all {selectedPeopleFilter !== 'all'
                ? 'bg-blue-100 dark:bg-blue-900/40 border-blue-400 text-blue-700 dark:text-blue-300'
                : 'border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'}"
              on:click|stopPropagation={() => {
                showPeopleMenu = !showPeopleMenu;
                showTypeMenu = false;
                showModifiedMenu = false;
              }}
            >
              <span>People</span>
              {#if selectedPeopleFilter !== 'all'}
                <span class="font-bold">: {selectedPeopleFilter === 'me' ? 'Owned by me' : 'Shared by others'}</span>
              {/if}
              <ChevronDown size={14} class="text-slate-400" />
            </button>

            {#if showPeopleMenu}
              <!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
              <div
                class="absolute left-0 top-10 z-40 w-44 bg-white dark:bg-[#282A2C] rounded-xl shadow-xl border border-slate-200 dark:border-slate-700 p-1.5 text-xs animate-in fade-in zoom-in-95 duration-75"
                on:click|stopPropagation
              >
                <button
                  class="w-full text-left px-3 py-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 {selectedPeopleFilter === 'all' ? 'text-blue-600 font-semibold' : ''}"
                  on:click={() => { selectedPeopleFilter = 'all'; showPeopleMenu = false; }}
                >
                  Anyone
                </button>
                <button
                  class="w-full text-left px-3 py-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 {selectedPeopleFilter === 'me' ? 'text-blue-600 font-semibold' : ''}"
                  on:click={() => { selectedPeopleFilter = 'me'; showPeopleMenu = false; }}
                >
                  Owned by me
                </button>
                <button
                  class="w-full text-left px-3 py-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 {selectedPeopleFilter === 'not_me' ? 'text-blue-600 font-semibold' : ''}"
                  on:click={() => { selectedPeopleFilter = 'not_me'; showPeopleMenu = false; }}
                >
                  Not owned by me
                </button>
              </div>
            {/if}
          </div>

          <!-- Modified Date Filter Chip -->
          <div class="relative">
            <button
              class="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-all {selectedModifiedFilter !== 'all'
                ? 'bg-blue-100 dark:bg-blue-900/40 border-blue-400 text-blue-700 dark:text-blue-300'
                : 'border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'}"
              on:click|stopPropagation={() => {
                showModifiedMenu = !showModifiedMenu;
                showTypeMenu = false;
                showPeopleMenu = false;
              }}
            >
              <span>Modified</span>
              {#if selectedModifiedFilter !== 'all'}
                <span class="font-bold">: {selectedModifiedFilter}</span>
              {/if}
              <ChevronDown size={14} class="text-slate-400" />
            </button>

            {#if showModifiedMenu}
              <!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
              <div
                class="absolute left-0 top-10 z-40 w-44 bg-white dark:bg-[#282A2C] rounded-xl shadow-xl border border-slate-200 dark:border-slate-700 p-1.5 text-xs animate-in fade-in zoom-in-95 duration-75"
                on:click|stopPropagation
              >
                <button
                  class="w-full text-left px-3 py-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 {selectedModifiedFilter === 'all' ? 'text-blue-600 font-semibold' : ''}"
                  on:click={() => { selectedModifiedFilter = 'all'; showModifiedMenu = false; }}
                >
                  Any time
                </button>
                <button
                  class="w-full text-left px-3 py-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 {selectedModifiedFilter === 'today' ? 'text-blue-600 font-semibold' : ''}"
                  on:click={() => { selectedModifiedFilter = 'today'; showModifiedMenu = false; }}
                >
                  Today
                </button>
                <button
                  class="w-full text-left px-3 py-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 {selectedModifiedFilter === '7days' ? 'text-blue-600 font-semibold' : ''}"
                  on:click={() => { selectedModifiedFilter = '7days'; showModifiedMenu = false; }}
                >
                  Last 7 days
                </button>
                <button
                  class="w-full text-left px-3 py-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 {selectedModifiedFilter === '30days' ? 'text-blue-600 font-semibold' : ''}"
                  on:click={() => { selectedModifiedFilter = '30days'; showModifiedMenu = false; }}
                >
                  Last 30 days
                </button>
                <button
                  class="w-full text-left px-3 py-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 {selectedModifiedFilter === 'earlier' ? 'text-blue-600 font-semibold' : ''}"
                  on:click={() => { selectedModifiedFilter = 'earlier'; showModifiedMenu = false; }}
                >
                  Earlier
                </button>
              </div>
            {/if}
          </div>

          <!-- Clear Filters Button -->
          {#if hasActiveFilters}
            <button
              class="flex items-center space-x-1 px-2.5 py-1 rounded-lg text-xs font-medium text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-200/50 dark:hover:bg-slate-800 transition-colors"
              on:click={clearAllFilters}
            >
              <X size={14} />
              <span>Clear filters</span>
            </button>
          {/if}
        </div>

        <!-- Right: View Toggle (Grid vs List) & Sorting -->
        <div class="flex items-center space-x-2">
          {#if activeSection === 'trash'}
            <button
              class="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-medium text-xs shadow-xs transition-colors"
              on:click={handleEmptyTrash}
            >
              <Trash2 size={14} />
              <span>Empty trash</span>
            </button>
          {/if}

          <!-- View Toggle -->
          <div class="flex items-center bg-slate-200/70 dark:bg-slate-800 p-0.5 rounded-lg border border-slate-300/60 dark:border-slate-700/60">
            <button
              class="p-1.5 rounded-md transition-colors {viewMode === 'list'
                ? 'bg-white dark:bg-[#282A2C] text-blue-600 dark:text-blue-400 shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'}"
              on:click={() => (viewMode = 'list')}
              title="List layout"
            >
              <List size={16} />
            </button>
            <button
              class="p-1.5 rounded-md transition-colors {viewMode === 'grid'
                ? 'bg-white dark:bg-[#282A2C] text-blue-600 dark:text-blue-400 shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'}"
              on:click={() => (viewMode = 'grid')}
              title="Grid layout"
            >
              <Grid size={16} />
            </button>
          </div>
        </div>
      </div>

      <!-- BREADCRUMBS & SECTION TITLE -->
      <div class="px-6 py-2 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 border-b border-slate-200/40 dark:border-slate-800/40 bg-white/20 dark:bg-[#1E1F20]/20">
        <div class="flex items-center space-x-1.5">
          <button
            class="hover:text-blue-600 dark:hover:text-blue-400 font-medium {activeFolderId === null ? 'text-slate-900 dark:text-slate-100 font-semibold text-sm' : ''}"
            on:click={() => (activeFolderId = null)}
          >
            {getSectionTitle(activeSection)}
          </button>
          {#if activeFolder}
            <ChevronRight size={14} />
            <span class="text-slate-900 dark:text-slate-100 font-semibold text-sm flex items-center space-x-1">
              <Folder size={15} class="text-blue-500" />
              <span>{activeFolder.name}</span>
            </span>
          {/if}
        </div>

        <div class="text-[11px] text-slate-400">
          {filteredItems.length} {filteredItems.length === 1 ? 'item' : 'items'}
        </div>
      </div>

      <!-- MAIN SCROLLABLE FILES LIST / GRID -->
      <div class="flex-1 overflow-y-auto p-6 space-y-6">
        <!-- Error / Notice Banner -->
        {#if lastSyncErrorNotice}
          <div class="p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800/50 flex items-center justify-between text-xs text-rose-800 dark:text-rose-200 animate-in fade-in">
            <div class="flex items-center space-x-2">
              <AlertOctagon size={16} class="text-rose-600 shrink-0" />
              <span>{lastSyncErrorNotice}</span>
            </div>
            <div class="flex items-center space-x-2 shrink-0">
              <button
                class="px-3 py-1 bg-rose-600 hover:bg-rose-700 text-white rounded-lg font-semibold text-[11px] shadow-2xs"
                on:click={() => (showCloudModal = true)}
              >
                Re-link Account
              </button>
              <button
                class="px-3 py-1 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded-lg font-semibold text-[11px]"
                on:click={() => setStorageTarget('local')}
              >
                Use Local Storage
              </button>
            </div>
          </div>
        {/if}

        <!-- Trash Notice Banner -->
        {#if activeSection === 'trash'}
          <div class="p-4 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/50 flex items-center justify-between text-xs text-amber-800 dark:text-amber-200">
            <div class="flex items-center space-x-2">
              <AlertOctagon size={16} class="text-amber-600" />
              <span>Items in trash are stored offline on this computer. They can be restored at any time or deleted forever.</span>
            </div>
          </div>
        {/if}

        <!-- Empty state when no items match -->
        {#if filteredItems.length === 0}
          <div class="h-80 flex flex-col items-center justify-center text-center space-y-3.5 max-w-md mx-auto">
            <div class="w-16 h-16 rounded-full {isCloudMode ? 'bg-blue-100 dark:bg-blue-950/50 text-blue-600' : 'bg-slate-200/60 dark:bg-slate-800 text-slate-400'} flex items-center justify-center shadow-xs">
              {#if isCloudMode}
                <Cloud size={30} />
              {:else}
                <HardDrive size={30} />
              {/if}
            </div>

            <div class="text-slate-700 dark:text-slate-200 font-semibold text-base">
              {#if hasActiveFilters}
                No files match your search criteria
              {:else if isCloudMode}
                No files found in {cloudProviderName}
              {:else}
                Your Local Offline Storage is Ready
              {/if}
            </div>

            <p class="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              {#if hasActiveFilters}
                Try clearing or adjusting your filter criteria.
              {:else if isCloudMode}
                {#if $activeAccount?.accessToken}
                  Connected to <strong>{$activeAccount.email}</strong>.
                  <span class="block mt-2 text-[11px] text-amber-800 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 p-2.5 rounded-xl text-left">
                    <strong>⚠️ Tip for Google Playground:</strong> In Step 1, make sure to check <strong>Google Drive API v3 -> <code class="font-mono bg-white/70 px-1 py-0.5 rounded">https://www.googleapis.com/auth/drive</code></strong>. If you only selected <code>drive.file</code>, Google only shows files created with this app.
                  </span>
                {:else}
                  No cloud drive account is linked yet. Click "Link Cloud Drive" to connect Google Drive, OneDrive, or Dropbox.
                {/if}
              {:else}
                Drop files here or click "+ New" to create new Docs, Sheets, Slides, or Forms locally on your computer.
              {/if}
            </p>

            <div class="flex flex-wrap items-center justify-center gap-2 pt-1">
              {#if isCloudMode}
                <button
                  class="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs shadow-xs flex items-center space-x-1.5 transition-all"
                  on:click={() => (showCloudModal = true)}
                >
                  <Cloud size={14} />
                  <span>{$activeAccount ? 'Manage Cloud Account' : 'Link Cloud Drive'}</span>
                </button>
                <button
                  class="px-4 py-2 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-700 font-semibold text-xs transition-colors flex items-center space-x-1.5"
                  on:click={() => setStorageTarget('local')}
                >
                  <HardDrive size={14} />
                  <span>Switch to Local Storage</span>
                </button>
                {#if $activeAccount?.accessToken}
                  <button
                    class="px-4 py-2 rounded-xl border border-slate-300 hover:bg-slate-100 text-slate-700 font-semibold text-xs transition-colors flex items-center space-x-1.5"
                    on:click={fetchLiveGoogleDrive}
                  >
                    <RefreshCw size={13} class={isFetchingCloudFiles ? 'animate-spin' : ''} />
                    <span>Refresh Drive</span>
                  </button>
                {/if}
              {:else}
                <button
                  class="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs shadow-xs flex items-center space-x-1.5 transition-all"
                  on:click={() => handleCreateDocument('doc')}
                >
                  <Plus size={14} />
                  <span>Create New Document</span>
                </button>
                <button
                  class="px-4 py-2 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-700 font-semibold text-xs transition-colors flex items-center space-x-1.5"
                  on:click={() => {
                    if (!$activeAccount && $cloudAccounts.length === 0) {
                      showCloudModal = true;
                    } else {
                      setStorageTarget('cloud');
                    }
                  }}
                >
                  <Cloud size={14} />
                  <span>Switch to Cloud Drive</span>
                </button>
              {/if}
            </div>
          </div>
        {:else}

          <!-- FOLDERS SECTION (if any folders present) -->
          {#if folderItems.length > 0 && activeSection === 'my_drive'}
            <div class="space-y-3">
              <div class="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                Folders
              </div>
              <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                {#each folderItems as folder}
                  <!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
                  <div
                    class="group relative flex items-center justify-between p-3.5 rounded-xl border bg-white dark:bg-[#1E1F20] hover:bg-blue-50/40 dark:hover:bg-slate-800 transition-all cursor-pointer select-none {selectedItemId === folder.id
                      ? 'border-blue-500 ring-2 ring-blue-500/20 shadow-md bg-blue-50/50 dark:bg-blue-950/30'
                      : 'border-slate-200/80 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 shadow-xs'}"
                    on:click={() => handleItemClick(folder)}
                    on:dblclick={() => handleItemDoubleClick(folder)}
                    on:contextmenu={(e) => handleContextMenu(folder, e)}
                  >
                    <div class="flex items-center space-x-3 truncate">
                      <Folder size={22} class="text-slate-500 group-hover:text-blue-600 shrink-0 transition-colors" />
                      <span class="text-xs font-medium text-slate-800 dark:text-slate-200 truncate">
                        {folder.name}
                      </span>
                    </div>

                    <div class="flex items-center space-x-1 shrink-0">
                      <button
                        class="p-1 rounded-full text-slate-400 hover:text-amber-500 transition-colors {folder.isStarred ? 'text-amber-500' : 'opacity-0 group-hover:opacity-100'}"
                        on:click={(e) => toggleStar(folder, e)}
                        title={folder.isStarred ? 'Starred' : 'Add star'}
                      >
                        <Star size={14} fill={folder.isStarred ? 'currentColor' : 'none'} />
                      </button>

                      <button
                        class="p-1 rounded-full text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 opacity-0 group-hover:opacity-100 transition-opacity"
                        on:click|stopPropagation={(e) => handleContextMenu(folder, e)}
                        title="More actions"
                      >
                        <MoreVertical size={14} />
                      </button>
                    </div>
                  </div>
                {/each}
              </div>
            </div>
          {/if}

          <!-- FILES SECTION -->
          {#if sortedFiles.length > 0}
            <div class="space-y-3">
              <div class="flex items-center justify-between">
                <div class="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Files
                </div>
              </div>

              <!-- 1. GRID VIEW -->
              {#if viewMode === 'grid'}
                <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                  {#each sortedFiles as file}
                    <!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
                    <div
                      class="group relative flex flex-col rounded-2xl border bg-white dark:bg-[#1E1F20] hover:shadow-md transition-all cursor-pointer overflow-hidden select-none {selectedItemId === file.id
                        ? 'border-blue-500 ring-2 ring-blue-500/20 bg-blue-50/20 dark:bg-blue-950/20 shadow-sm'
                        : 'border-slate-200/80 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 shadow-xs'}"
                      on:click={() => handleItemClick(file)}
                      on:dblclick={() => handleItemDoubleClick(file)}
                      on:contextmenu={(e) => handleContextMenu(file, e)}
                    >
                      <!-- Top Header in Card -->
                      <div class="p-3 pb-2 flex items-center justify-between border-b border-slate-100 dark:border-slate-800/60">
                        <div class="flex items-center space-x-2 truncate">
                          <!-- App Icon -->
                          {#if file.type === 'doc'}
                            <div class="w-5 h-5 rounded bg-blue-600 flex items-center justify-center text-white shrink-0">
                              <FileText size={12} />
                            </div>
                          {:else if file.type === 'sheet'}
                            <div class="w-5 h-5 rounded bg-emerald-600 flex items-center justify-center text-white shrink-0">
                              <Sheet size={12} />
                            </div>
                          {:else if file.type === 'slide'}
                            <div class="w-5 h-5 rounded bg-amber-500 flex items-center justify-center text-white shrink-0">
                              <Presentation size={12} />
                            </div>
                          {:else if file.type === 'form'}
                            <div class="w-5 h-5 rounded bg-purple-600 flex items-center justify-center text-white shrink-0">
                              <FileCheck size={12} />
                            </div>
                          {:else}
                            <div class="w-5 h-5 rounded bg-rose-600 flex items-center justify-center text-white shrink-0">
                              <File size={12} />
                            </div>
                          {/if}

                          <span class="text-xs font-semibold text-slate-800 dark:text-slate-100 truncate" title={file.name}>
                            {file.name}
                          </span>
                        </div>

                        <!-- Card 3-dot Menu Button -->
                        <button
                          class="p-1 rounded-full text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 opacity-0 group-hover:opacity-100 transition-opacity"
                          on:click|stopPropagation={(e) => handleContextMenu(file, e)}
                          title="Actions"
                        >
                          <MoreVertical size={14} />
                        </button>
                      </div>

                      <!-- Thumbnail Simulation Canvas -->
                      <div class="h-32 bg-[#F8FAFD] dark:bg-[#161718] p-3 flex flex-col justify-between overflow-hidden relative border-b border-slate-100 dark:border-slate-800/60">
                        {#if file.contentSnippet}
                          <p class="text-[10px] text-slate-500 dark:text-slate-400 leading-relaxed line-clamp-4 select-none italic font-serif">
                            "{file.contentSnippet}"
                          </p>
                        {:else}
                          <div class="h-full flex items-center justify-center text-slate-300 dark:text-slate-600">
                            <File size={36} strokeWidth={1.5} />
                          </div>
                        {/if}

                        <!-- Workspace Active Status Pill -->
                        {#if file.workspaceDocId && activeWorkspaceDocIds.includes(file.workspaceDocId)}
                          <div class="absolute bottom-2 left-2 px-1.5 py-0.5 rounded bg-blue-600 text-white text-[9px] font-bold tracking-tight">
                            OPEN IN WORKSPACE
                          </div>
                        {/if}
                      </div>

                      <!-- Bottom Card Footer (Owner, Date, Star) -->
                      <div class="p-3 pt-2.5 flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
                        <div class="flex items-center space-x-1.5 truncate">
                          <span class="truncate">{file.owner}</span>
                          <span>•</span>
                          <span>{file.lastModified}</span>
                        </div>

                        <button
                          class="p-1 rounded-full transition-colors {file.isStarred ? 'text-amber-500' : 'text-slate-300 hover:text-amber-400'}"
                          on:click={(e) => toggleStar(file, e)}
                          title={file.isStarred ? 'Starred' : 'Add star'}
                        >
                          <Star size={13} fill={file.isStarred ? 'currentColor' : 'none'} />
                        </button>
                      </div>
                    </div>
                  {/each}
                </div>

              <!-- 2. LIST VIEW -->
              {:else}
                <div class="bg-white dark:bg-[#1E1F20] rounded-2xl border border-slate-200/80 dark:border-slate-800 overflow-hidden shadow-xs">
                  <table class="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr class="border-b border-slate-200/80 dark:border-slate-800 text-slate-500 dark:text-slate-400 font-semibold bg-slate-50/50 dark:bg-slate-800/30">
                        <th class="py-3 px-4 cursor-pointer hover:text-blue-600" on:click={() => handleSort('name')}>
                          <div class="flex items-center space-x-1.5">
                            <span>Name</span>
                            {#if sortField === 'name'}
                              {#if sortAscending}<ArrowUp size={13} />{:else}<ArrowDown size={13} />{/if}
                            {/if}
                          </div>
                        </th>
                        <th class="py-3 px-4 cursor-pointer hover:text-blue-600 hidden md:table-cell" on:click={() => handleSort('owner')}>
                          <div class="flex items-center space-x-1.5">
                            <span>Owner</span>
                            {#if sortField === 'owner'}
                              {#if sortAscending}<ArrowUp size={13} />{:else}<ArrowDown size={13} />{/if}
                            {/if}
                          </div>
                        </th>
                        <th class="py-3 px-4 cursor-pointer hover:text-blue-600" on:click={() => handleSort('lastModified')}>
                          <div class="flex items-center space-x-1.5">
                            <span>Last modified</span>
                            {#if sortField === 'lastModified'}
                              {#if sortAscending}<ArrowUp size={13} />{:else}<ArrowDown size={13} />{/if}
                            {/if}
                          </div>
                        </th>
                        <th class="py-3 px-4 cursor-pointer hover:text-blue-600 hidden sm:table-cell" on:click={() => handleSort('fileSize')}>
                          <div class="flex items-center space-x-1.5">
                            <span>File size</span>
                            {#if sortField === 'fileSize'}
                              {#if sortAscending}<ArrowUp size={13} />{:else}<ArrowDown size={13} />{/if}
                            {/if}
                          </div>
                        </th>
                        <th class="py-3 px-4 w-12 text-center"></th>
                      </tr>
                    </thead>
                    <tbody class="divide-y divide-slate-100 dark:divide-slate-800/60">
                      {#each sortedFiles as file}
                        <tr
                          class="group hover:bg-blue-50/40 dark:hover:bg-slate-800/60 cursor-pointer transition-colors {selectedItemId === file.id
                            ? 'bg-blue-50/70 dark:bg-blue-950/40'
                            : ''}"
                          on:click={() => handleItemClick(file)}
                          on:dblclick={() => handleItemDoubleClick(file)}
                          on:contextmenu={(e) => handleContextMenu(file, e)}
                        >
                          <!-- Name Column -->
                          <td class="py-3 px-4">
                            <div class="flex items-center space-x-3">
                              <!-- App Icon -->
                              {#if file.type === 'doc'}
                                <div class="w-5 h-5 rounded bg-blue-600 flex items-center justify-center text-white shrink-0">
                                  <FileText size={12} />
                                </div>
                              {:else if file.type === 'sheet'}
                                <div class="w-5 h-5 rounded bg-emerald-600 flex items-center justify-center text-white shrink-0">
                                  <Sheet size={12} />
                                </div>
                              {:else if file.type === 'slide'}
                                <div class="w-5 h-5 rounded bg-amber-500 flex items-center justify-center text-white shrink-0">
                                  <Presentation size={12} />
                                </div>
                              {:else if file.type === 'form'}
                                <div class="w-5 h-5 rounded bg-purple-600 flex items-center justify-center text-white shrink-0">
                                  <FileCheck size={12} />
                                </div>
                              {:else}
                                <div class="w-5 h-5 rounded bg-rose-600 flex items-center justify-center text-white shrink-0">
                                  <File size={12} />
                                </div>
                              {/if}

                              <span class="font-medium text-slate-800 dark:text-slate-100 truncate" title={file.name}>
                                {file.name}
                              </span>

                              <!-- Star icon -->
                              <button
                                class="p-0.5 rounded transition-colors {file.isStarred ? 'text-amber-500' : 'text-slate-300 opacity-0 group-hover:opacity-100 hover:text-amber-400'}"
                                on:click={(e) => toggleStar(file, e)}
                                title={file.isStarred ? 'Starred' : 'Add star'}
                              >
                                <Star size={13} fill={file.isStarred ? 'currentColor' : 'none'} />
                              </button>
                            </div>
                          </td>

                          <!-- Owner Column -->
                          <td class="py-3 px-4 text-slate-600 dark:text-slate-300 hidden md:table-cell">
                            {file.owner}
                          </td>

                          <!-- Last Modified Column -->
                          <td class="py-3 px-4 text-slate-500 dark:text-slate-400">
                            {file.lastModified}
                          </td>

                          <!-- File Size Column -->
                          <td class="py-3 px-4 text-slate-500 dark:text-slate-400 font-mono text-[11px] hidden sm:table-cell">
                            {file.fileSize}
                          </td>

                          <!-- 3-dot Action Menu -->
                          <td class="py-3 px-4 text-center">
                            <button
                              class="p-1 rounded-full text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-200/50 dark:hover:bg-slate-700 opacity-0 group-hover:opacity-100 transition-opacity"
                              on:click|stopPropagation={(e) => handleContextMenu(file, e)}
                              title="Actions"
                            >
                              <MoreVertical size={15} />
                            </button>
                          </td>
                        </tr>
                      {/each}
                    </tbody>
                  </table>
                </div>
              {/if}
            </div>
          {/if}
        {/if}
      </div>
    </main>

    <!-- RIGHT DETAILS / INFO SIDEBAR -->
    {#if showDetailsSidebar}
      <aside class="w-72 bg-white/70 dark:bg-[#1E1F20]/70 border-l border-slate-200/80 dark:border-slate-800/80 flex flex-col p-5 shrink-0 overflow-y-auto select-none space-y-5 animate-in slide-in-from-right duration-150">
        <div class="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
          <span class="text-sm font-semibold text-slate-800 dark:text-slate-100">
            {selectedItem ? selectedItem.name : 'Google Drive Offline Hub'}
          </span>
          <button
            class="p-1 rounded-full text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
            on:click={() => (showDetailsSidebar = false)}
            title="Close details"
          >
            <X size={16} />
          </button>
        </div>

        {#if selectedItem}
          <!-- Selected Item Preview Card -->
          <div class="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#161718] p-4 flex flex-col items-center justify-center text-center space-y-2">
            {#if selectedItem.type === 'doc'}
              <div class="w-12 h-12 rounded-xl bg-blue-600 flex items-center justify-center text-white shadow-sm">
                <FileText size={24} />
              </div>
            {:else if selectedItem.type === 'sheet'}
              <div class="w-12 h-12 rounded-xl bg-emerald-600 flex items-center justify-center text-white shadow-sm">
                <Sheet size={24} />
              </div>
            {:else if selectedItem.type === 'slide'}
              <div class="w-12 h-12 rounded-xl bg-amber-500 flex items-center justify-center text-white shadow-sm">
                <Presentation size={24} />
              </div>
            {:else if selectedItem.type === 'form'}
              <div class="w-12 h-12 rounded-xl bg-purple-600 flex items-center justify-center text-white shadow-sm">
                <FileCheck size={24} />
              </div>
            {:else if selectedItem.type === 'folder'}
              <div class="w-12 h-12 rounded-xl bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center text-blue-600 dark:text-blue-400 shadow-sm">
                <Folder size={24} />
              </div>
            {:else}
              <div class="w-12 h-12 rounded-xl bg-rose-600 flex items-center justify-center text-white shadow-sm">
                <File size={24} />
              </div>
            {/if}

            <span class="text-xs font-semibold text-slate-800 dark:text-slate-100 break-words max-w-full">
              {selectedItem.name}
            </span>
            <span class="text-[11px] text-slate-500 font-mono">
              {selectedItem.fileSize}
            </span>
          </div>

          <!-- Quick Action Buttons -->
          <div class="grid grid-cols-2 gap-2">
            <button
              class="w-full py-2 px-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-medium text-xs flex items-center justify-center space-x-1.5 shadow-sm transition-colors"
              on:click={() => openItem(selectedItem)}
            >
              <Eye size={14} />
              <span>Open</span>
            </button>
            <button
              class="w-full py-2 px-3 rounded-xl border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 font-medium text-xs flex items-center justify-center space-x-1.5 transition-colors"
              on:click={() => handleDownload(selectedItem)}
            >
              <Download size={14} />
              <span>Download</span>
            </button>
          </div>

          <!-- Document Specifications -->
          <div class="space-y-3 text-xs">
            <div class="font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider text-[10px]">
              File Details
            </div>

            <div class="space-y-2.5 text-slate-700 dark:text-slate-300">
              <div class="flex items-center justify-between">
                <span class="text-slate-500">Type</span>
                <span class="font-medium capitalize">{getAppLabel(selectedItem.type)}</span>
              </div>
              <div class="flex items-center justify-between">
                <span class="text-slate-500">Owner</span>
                <span class="font-medium">{selectedItem.owner}</span>
              </div>
              <div class="flex items-center justify-between">
                <span class="text-slate-500">Last Modified</span>
                <span class="font-medium">{selectedItem.lastModified}</span>
              </div>
              <div class="flex items-center justify-between">
                <span class="text-slate-500">Storage Location</span>
                <span class="font-medium font-mono text-[11px] text-emerald-600 dark:text-emerald-400">Local Disk (Offline)</span>
              </div>
            </div>
          </div>
        {:else}
          <!-- Default Hub Info -->
          <div class="space-y-4 text-xs text-slate-600 dark:text-slate-400">
            <div class="p-4 rounded-xl bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900/40 space-y-2">
              <div class="flex items-center space-x-2 text-blue-700 dark:text-blue-300 font-semibold">
                <CheckCircle2 size={16} />
                <span>100% Offline Workspace</span>
              </div>
              <p class="text-[11px] text-slate-600 dark:text-slate-300 leading-relaxed">
                All files, folders, and templates in your Google Drive Hub execute and store completely on your local computer.
              </p>
            </div>

            <div class="space-y-2 pt-2">
              <span class="font-semibold text-slate-800 dark:text-slate-200 block text-xs">Quick Tips:</span>
              <ul class="space-y-1.5 text-[11px] list-disc list-inside">
                <li>Double click any file to edit in Google Docs, Sheets, Slides, or PDF Viewer.</li>
                <li>Right click any item for quick actions (rename, download, copy, trash).</li>
                <li>Filter by Type, Owner, or Date using the top chips.</li>
              </ul>
            </div>
          </div>
        {/if}
      </aside>
    {/if}
  </div>

  <!-- CONTEXT MENU (RIGHT-CLICK) -->
  {#if contextMenuVisible && contextMenuItem}
    <!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
    <div
      class="fixed z-50 w-52 bg-white dark:bg-[#282A2C] rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 p-1.5 text-xs select-none animate-in fade-in zoom-in-95 duration-100"
      style="left: {contextMenuPos.x}px; top: {contextMenuPos.y}px;"
      on:click|stopPropagation
    >
      <button
        class="w-full flex items-center space-x-2.5 px-3 py-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-100 font-medium transition-colors"
        on:click={() => { openItem(contextMenuItem); closeContextMenu(); }}
      >
        <Eye size={15} class="text-blue-500" />
        <span>Open</span>
      </button>

      <button
        class="w-full flex items-center space-x-2.5 px-3 py-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-100 font-medium transition-colors"
        on:click={() => { toggleStar(contextMenuItem); closeContextMenu(); }}
      >
        <Star size={15} class="text-amber-500" fill={contextMenuItem.isStarred ? 'currentColor' : 'none'} />
        <span>{contextMenuItem.isStarred ? 'Remove from Starred' : 'Add to Starred'}</span>
      </button>

      <button
        class="w-full flex items-center space-x-2.5 px-3 py-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-100 font-medium transition-colors"
        on:click={() => { openRenameDialog(contextMenuItem); closeContextMenu(); }}
      >
        <Edit3 size={15} class="text-slate-500" />
        <span>Rename</span>
      </button>

      {#if contextMenuItem.type !== 'folder'}
        <button
          class="w-full flex items-center space-x-2.5 px-3 py-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-100 font-medium transition-colors"
          on:click={() => { handleMakeCopy(contextMenuItem); closeContextMenu(); }}
        >
          <Copy size={15} class="text-slate-500" />
          <span>Make a copy</span>
        </button>

        <button
          class="w-full flex items-center space-x-2.5 px-3 py-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-100 font-medium transition-colors"
          on:click={() => { handleDownload(contextMenuItem); closeContextMenu(); }}
        >
          <Download size={15} class="text-slate-500" />
          <span>Download</span>
        </button>
      {/if}

      <div class="border-t border-slate-200 dark:border-slate-700 my-1"></div>

      {#if contextMenuItem.isTrashed}
        <button
          class="w-full flex items-center space-x-2.5 px-3 py-2 rounded-xl hover:bg-emerald-50 dark:hover:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 font-medium transition-colors"
          on:click={() => { handleRestoreFromTrash(contextMenuItem); closeContextMenu(); }}
        >
          <RotateCcw size={15} />
          <span>Restore from Trash</span>
        </button>
        <button
          class="w-full flex items-center space-x-2.5 px-3 py-2 rounded-xl hover:bg-rose-50 dark:hover:bg-rose-950/40 text-rose-600 dark:text-rose-400 font-medium transition-colors"
          on:click={() => { handleDeleteForever(contextMenuItem); closeContextMenu(); }}
        >
          <Trash2 size={15} />
          <span>Delete forever</span>
        </button>
      {:else}
        <button
          class="w-full flex items-center space-x-2.5 px-3 py-2 rounded-xl hover:bg-rose-50 dark:hover:bg-rose-950/40 text-rose-600 dark:text-rose-400 font-medium transition-colors"
          on:click={() => { handleMoveToTrash(contextMenuItem); closeContextMenu(); }}
        >
          <Trash2 size={15} />
          <span>Move to Trash</span>
        </button>
      {/if}
    </div>
  {/if}

  <!-- NEW FOLDER MODAL -->
  {#if showNewFolderModal}
    <!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
    <div
      class="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-100"
      on:click={() => (showNewFolderModal = false)}
    >
      <div
        class="bg-white dark:bg-[#282A2C] rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 p-6 w-96 text-xs text-slate-800 dark:text-slate-100 space-y-4"
        on:click|stopPropagation
      >
        <div class="font-semibold text-base">New folder</div>
        <input
          type="text"
          bind:value={newFolderName}
          class="w-full bg-slate-50 dark:bg-[#1E1F20] border border-blue-500 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 dark:text-slate-100 outline-none"
          on:keydown={(e) => { if (e.key === 'Enter') handleCreateFolder(); }}
        />
        <div class="flex items-center justify-end space-x-2 pt-2">
          <button
            class="px-4 py-2 rounded-full text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/40 font-medium transition-colors"
            on:click={() => (showNewFolderModal = false)}
          >
            Cancel
          </button>
          <button
            class="px-5 py-2 rounded-full bg-blue-600 hover:bg-blue-500 text-white font-medium shadow-sm transition-colors"
            on:click={handleCreateFolder}
          >
            Create
          </button>
        </div>
      </div>
    </div>
  {/if}

  <!-- RENAME MODAL -->
  {#if showRenameModal}
    <!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
    <div
      class="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-100"
      on:click={() => (showRenameModal = false)}
    >
      <div
        class="bg-white dark:bg-[#282A2C] rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 p-6 w-96 text-xs text-slate-800 dark:text-slate-100 space-y-4"
        on:click|stopPropagation
      >
        <div class="font-semibold text-base">Rename</div>
        <input
          type="text"
          bind:value={renameItemName}
          class="w-full bg-slate-50 dark:bg-[#1E1F20] border border-blue-500 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 dark:text-slate-100 outline-none"
          on:keydown={(e) => { if (e.key === 'Enter') handleCommitRename(); }}
        />
        <div class="flex items-center justify-end space-x-2 pt-2">
          <button
            class="px-4 py-2 rounded-full text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/40 font-medium transition-colors"
            on:click={() => (showRenameModal = false)}
          >
            Cancel
          </button>
          <button
            class="px-5 py-2 rounded-full bg-blue-600 hover:bg-blue-500 text-white font-medium shadow-sm transition-colors"
            on:click={handleCommitRename}
          >
            OK
          </button>
        </div>
      </div>
    </div>
  {/if}

  <!-- FLOATING SNACKBAR NOTIFICATION -->
  {#if snackbarMessage}
    <div class="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-5 py-2.5 rounded-full bg-slate-900/90 text-white text-xs font-medium shadow-2xl flex items-center space-x-2 border border-slate-700 animate-in fade-in slide-in-from-bottom-2 duration-150">
      <CheckCircle2 size={16} class="text-emerald-400" />
      <span>{snackbarMessage}</span>
    </div>
  {/if}

  <!-- CLOUD SYNC & STORAGE SETTINGS MODAL -->
  {#if showCloudModal}
    <GoogleSyncModal on:close={() => { showCloudModal = false; fetchLiveGoogleDrive(); }} />
  {/if}
</div>
