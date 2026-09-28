<script lang="ts">
  /**
   * The Drive panel: connect to Google Drive, OneDrive, or SharePoint, then
   * browse and open files. One component for all three because they share a
   * shape; only the sign-in flow and the listing differ.
   */
  import { onMount } from 'svelte';
  import {
    Cloud,
    FileText,
    Folder,
    ChevronRight,
    RefreshCw,
    LogOut,
    ExternalLink,
    Loader2,
    AlertCircle,
    CheckCircle2,
    Table2,
    Presentation,
  } from '@lucide/svelte';
  import {
    PROVIDERS,
    signIn,
    refreshCredentials,
    MissingClientIdError,
    SignInCancelledError,
  } from '../../lib/oauthFlow';
  import {
    listEntries,
    listMicrosoftLibraries,
    formatBytes,
    type CloudEntry,
    type Library,
  } from '../../lib/cloudFiles';
  import { deleteSecret } from '../../lib/secureStore';
  import { saveToCloud } from '../../lib/cloudSave';
  import { downloadDriveFileBase64 } from '../../lib/googleDriveClient';
  import { base64ToArrayBuffer, downloadItem } from '../../lib/microsoftGraph';
  import type { CloudCredentials, CloudStorageAccount } from '../../types';
  import { isTauri } from '../../lib/tauri';

  export let account: CloudStorageAccount | null = null;
  export let settings: { googleOAuthClientId: string; microsoftOAuthClientId: string };
  /** Raised with the bytes and metadata so the app can route to a workspace. */
  export let onOpen: (entry: CloudEntry, bytes: ArrayBuffer) => void | Promise<void>;
  export let onOpenInBrowser: (entry: CloudEntry) => void;
  export let onDisconnect: () => void | Promise<void>;

  type ProviderKey = 'google' | 'microsoft';

  let provider: ProviderKey = 'google';
  let credentials: CloudCredentials | null = null;
  let entries: CloudEntry[] = [];
  let crumbs: { id?: string; name: string }[] = [];
  let libraries: Library[] = [];
  let folderId: string | undefined = undefined;

  let busy = false;
  let loading = false;
  let message = '';
  let error = '';
  let connected = false;

  const available = isTauri();
  const clientIdFor = (key: ProviderKey) =>
    key === 'google' ? settings.googleOAuthClientId : settings.microsoftOAuthClientId;

  onMount(async () => {
    if (account?.hasCredentials) {
      connected = true;
      provider = account.provider === 'google_drive' ? 'google' : 'microsoft';
      await load();
    }
  });

  function describeFailure(reason: unknown) {
    if (reason instanceof MissingClientIdError) {
      return `Add your ${PROVIDERS[reason.provider].label} client ID in Settings first.`;
    }
    if (reason instanceof SignInCancelledError) return '';
    if (reason instanceof Error) return reason.message;
    return 'Could not complete the connection.';
  }

  async function connect() {
    const key = provider;
    const config = PROVIDERS[key];

    busy = true;
    error = '';
    message = '';
    try {
      credentials = await signIn({ provider: key, clientId: clientIdFor(key) });
      connected = true;
      folderId = undefined;
      message = `Connected to ${config.label}.`;
      await load();
    } catch (reason) {
      // A cancelled consent screen is the user's choice, not a failure.
      const description = describeFailure(reason);
      if (description) error = description;
    } finally {
      busy = false;
    }
  }

  async function load() {
    if (!credentials) return;
    loading = true;
    error = '';
    try {
      // Prefer a fresh token, but fall back to the stored one rather than
      // dumping the user out of the panel on a transient refresh error.
      if (credentials.refreshToken) {
        try {
          credentials = await refreshCredentials(provider, credentials, clientIdFor(provider));
        } catch (reason) {
          // A rejected refresh token cannot be recovered from; that needs a
          // reconnect, and the listing error below will say so.
          if (reason instanceof Error && reason.message.includes('sign in again')) throw reason;
        }
      }

      const providerKey = provider;
      const result = await listEntries({
        provider: providerKey,
        credentials,
        folderId,
        driveId: account?.driveId,
      });
      entries = result.entries;
      crumbs = result.crumbs;

      if (providerKey === 'microsoft' && libraries.length === 0) {
        libraries = await listMicrosoftLibraries(credentials);
      }
    } catch (reason) {
      error = reason instanceof Error ? reason.message : 'Could not list files.';
    } finally {
      loading = false;
    }
  }

  async function openFolder(item: CloudEntry) {
    folderId = item.id;
    crumbs = [...crumbs, { id: item.id, name: item.name }];
    await load();
  }

  async function openFile(item: CloudEntry) {
    if (!credentials) return;
    loading = true;
    error = '';
    try {
      const bytes =
        provider === 'google' ? await downloadGoogle(item.id) : await downloadMicrosoft(item.id);
      await onOpen(item, bytes);
    } catch (reason) {
      error = reason instanceof Error ? reason.message : 'Could not open that file.';
    } finally {
      loading = false;
    }
  }

  async function downloadGoogle(id: string): Promise<ArrayBuffer> {
    if (!credentials?.accessToken) throw new Error('Not connected to Google Drive.');
    return base64ToArrayBuffer(await downloadDriveFileBase64(credentials.accessToken, id));
  }

  async function downloadMicrosoft(id: string): Promise<ArrayBuffer> {
    if (!credentials) throw new Error('Not connected.');
    return downloadItem(credentials, id);
  }

  /** Writes the current document back to the connected library. */
  export async function save(payload: {
    fileName: string;
    mimeType: string;
    bytes: ArrayBuffer;
  }) {
    if (!credentials) throw new Error('Connect a drive before saving.');
    const result = await saveToCloud({
      provider,
      credentials,
      fileName: payload.fileName,
      mimeType: payload.mimeType,
      bytes: payload.bytes,
      folderId,
    });
    message = result.note ?? `Saved ${result.name}.`;
    if (result.note) error = '';
    await load();
    return result;
  }

  function iconFor(item: CloudEntry) {
    if (item.isFolder) return Folder;
    if (item.workspace === 'sheets') return Table2;
    if (item.workspace === 'slides') return Presentation;
    return FileText;
  }

  const workspaceLabel: Record<string, string> = {
    writer: 'Writer',
    sheets: 'Sheets',
    slides: 'Slides',
  };
</script>

<section class="h-full flex flex-col overflow-hidden" data-testid="drive-panel">
  <header class="px-5 py-4 border-b border-[color:var(--lg-border)] flex items-center justify-between gap-3 shrink-0">
    <div class="flex items-center gap-2">
      <Cloud size={18} class="text-[color:var(--lg-text-dim)]" />
      <h2 class="text-sm font-semibold">Drive</h2>
    </div>

    {#if connected}
      <button
        class="text-xs flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg hover:bg-[color:var(--lg-hover)] transition"
        on:click={load}
        disabled={loading}
        aria-label="Refresh file list"
      >
        <RefreshCw size={13} class={loading ? 'animate-spin' : ''} />
        Refresh
      </button>
    {/if}
  </header>

  <div class="flex-1 overflow-y-auto px-5 py-4">
    {#if !available}
      <p class="text-sm text-[color:var(--lg-text-dim)]">
        Cloud connections are available in the desktop app.
      </p>
    {:else if !connected}
      <div class="max-w-md mx-auto py-8 text-center">
        <h3 class="text-base font-semibold mb-1.5">Connect your files</h3>
        <p class="text-sm text-[color:var(--lg-text-dim)] mb-6">
          Open documents straight from Google Drive, OneDrive, or SharePoint.
        </p>

        <div class="inline-flex rounded-xl p-1 bg-[color:var(--lg-surface)] border border-[color:var(--lg-border)] mb-5">
          {#each Object.values(PROVIDERS) as option}
            <button
              class="px-3.5 py-1.5 text-xs rounded-lg transition {provider === option.id
                ? 'bg-[color:var(--lg-accent-soft)] font-medium'
                : 'opacity-70 hover:opacity-100'}"
              on:click={() => (provider = option.id)}
            >
              {option.id === 'google' ? 'Google Drive' : 'OneDrive / SharePoint'}
            </button>
          {/each}
        </div>

        <button
          class="w-full px-4 py-2.5 rounded-xl bg-[color:var(--lg-accent)] text-white text-sm font-medium flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
          on:click={connect}
          disabled={busy}
        >
          {#if busy}
            <Loader2 size={15} class="animate-spin" />
            Waiting for sign-in&hellip;
          {:else}
            Connect {PROVIDERS[provider].label}
          {/if}
        </button>

        {#if !clientIdFor(provider)}
          <p class="mt-4 text-xs text-[color:var(--lg-text-dim)] flex items-start gap-1.5 text-left">
            <AlertCircle size={13} class="mt-0.5 shrink-0" />
            <span>
              No client ID configured yet. Add one in Settings &rarr; Cloud using
              <code class="text-[10px] break-all">{PROVIDERS[provider].clientIdHint}</code>
            </span>
          </p>
        {/if}
      </div>
    {:else}
      {#if libraries.length > 1}
        <label class="block mb-3">
          <span class="text-[11px] text-[color:var(--lg-text-dim)]">Library</span>
          <select
            class="mt-1 w-full text-xs rounded-lg px-2.5 py-1.5 bg-[color:var(--lg-surface)] border border-[color:var(--lg-border)]"
            value={account?.driveId ?? ''}
            on:change={async (event) => {
              const id = (event.currentTarget as HTMLSelectElement).value;
              folderId = undefined;
              if (id) {
                account = { ...account!, driveId: id };
              } else {
                account = { ...account!, driveId: undefined };
              }
              await load();
            }}
          >
            <option value="">Default library</option>
            {#each libraries as library}
              <option value={library.id}>{library.name}</option>
            {/each}
          </select>
        </label>
      {/if}

      <nav class="flex items-center gap-1 text-[11px] text-[color:var(--lg-text-dim)] mb-3 flex-wrap">
        {#each crumbs as crumb, index (crumb.id ?? index)}
          {#if index > 0}<ChevronRight size={12} />{/if}
          <button
            class="hover:underline {index === crumbs.length - 1 ? 'text-[color:var(--lg-text)]' : ''}"
            on:click={async () => {
              crumbs = crumbs.slice(0, index + 1);
              folderId = crumb.id;
              await load();
            }}
          >
            {crumb.name}
          </button>
        {/each}
      </nav>

      {#if message}
        <p class="text-xs mb-3 flex items-center gap-1.5 text-emerald-400">
          <CheckCircle2 size={13} />{message}
        </p>
      {/if}

      {#if loading && entries.length === 0}
        <p class="text-sm text-[color:var(--lg-text-dim)] flex items-center gap-2">
          <Loader2 size={14} class="animate-spin" /> Loading&hellip;
        </p>
      {:else if entries.length === 0}
        <p class="text-sm text-[color:var(--lg-text-dim)]">This folder is empty.</p>
      {:else}
        <ul class="space-y-0.5">
          {#each entries as item (item.id)}
            {@const Icon = iconFor(item)}
            <li class="group flex items-center gap-2.5 px-2 py-2 rounded-lg hover:bg-[color:var(--lg-hover)] transition">
              <button
                class="flex-1 flex items-center gap-2.5 min-w-0 text-left"
                on:click={() => (item.isFolder ? openFolder(item) : openFile(item))}
                disabled={!item.isFolder && !item.workspace}
              >
                <Icon size={15} class="shrink-0 text-[color:var(--lg-text-dim)]" />
                <span class="text-sm truncate">{item.name}</span>
                {#if !item.isFolder && item.workspace}
                  <span class="text-[10px] px-1.5 py-0.5 rounded bg-[color:var(--lg-surface)] border border-[color:var(--lg-border)] text-[color:var(--lg-text-dim)] shrink-0">
                    {workspaceLabel[item.workspace]}
                  </span>
                {:else if !item.isFolder}
                  <span class="text-[10px] text-[color:var(--lg-text-dim)] shrink-0">unsupported</span>
                {/if}
              </button>

              <span class="text-[11px] text-[color:var(--lg-text-dim)] shrink-0">
                {formatBytes(item.size)}
              </span>

              {#if item.webUrl}
                <button
                  class="opacity-0 group-hover:opacity-100 transition p-1 rounded hover:bg-[color:var(--lg-surface)]"
                  on:click={() => onOpenInBrowser(item)}
                  aria-label="Open {item.name} in the provider's site"
                  title="Open in browser"
                >
                  <ExternalLink size={13} />
                </button>
              {/if}
            </li>
          {/each}
        </ul>
      {/if}
    {/if}
  </div>

  {#if error}
    <p
      class="mx-5 mb-4 text-xs p-2.5 rounded-lg flex items-start gap-1.5 bg-red-500/10 text-red-300 border border-red-500/20"
      role="alert"
    >
      <AlertCircle size={13} class="mt-0.5 shrink-0" />
      <span>{error}</span>
    </p>
  {/if}

  {#if connected}
    <footer class="px-5 py-3 border-t border-[color:var(--lg-border)] shrink-0">
      <button
        class="text-xs flex items-center gap-1.5 text-[color:var(--lg-text-dim)] hover:text-red-400 transition"
        on:click={async () => {
          // Revoke the local copy of the token; the app never held a secret
          // that would need revoking on the provider side.
          if (account?.id) await deleteSecret(account.id).catch(() => {});
          credentials = null;
          connected = false;
          entries = [];
          await onDisconnect();
        }}
      >
        <LogOut size={13} /> Disconnect
      </button>
    </footer>
  {/if}
</section>
