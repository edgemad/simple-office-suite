<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import {
    HardDrive,
    Settings,
    Keyboard,
    ShieldCheck,
    Cloud,
    FolderKanban,
    Sparkles,
    User,
    Building2,
    Check,
    Plus,
    LogOut
  } from 'lucide-svelte';
  import {
    googleAccounts,
    activeAccount,
    switchActiveAccount,
    removeGoogleAccount
  } from '../../lib/googleSync';
  import type { GoogleAccount } from '../../types';

  const dispatch = createEventDispatcher<{
    close: void;
    openSettings: void;
    openShortcuts: void;
    openDrive: void;
    openSyncModal: void;
    openGeminiSettings: void;
  }>();

  $: accounts = $googleAccounts;
  $: currentAcc = $activeAccount;
  $: isPersonal = currentAcc ? currentAcc.accountType === 'personal' : false;
</script>

<button
  type="button"
  class="fixed inset-0 z-50 bg-transparent cursor-default w-full h-full border-0 p-0"
  on:click={() => dispatch('close')}
  aria-label="Close Account Menu"
></button>

<div class="absolute right-4 top-14 z-50 w-84 bg-white rounded-3xl shadow-2xl border border-slate-200/90 p-5 text-slate-800 animate-in fade-in zoom-in-95 duration-100 select-none">
  <!-- Profile Header -->
  <div class="flex flex-col items-center text-center pb-4 border-b border-slate-100">
    {#if currentAcc}
      <div
        class="w-16 h-16 rounded-full text-white font-bold text-2xl flex items-center justify-center shadow-md mb-2 ring-4 {isPersonal ? 'ring-blue-100 bg-gradient-to-tr from-blue-600 via-indigo-600 to-purple-600' : 'ring-emerald-100 bg-gradient-to-tr from-emerald-600 to-teal-600'}"
      >
        {currentAcc.name.charAt(0).toUpperCase()}
      </div>
      
      <div class="flex items-center space-x-1.5">
        <span class="font-semibold text-slate-900 text-sm">{currentAcc.name}</span>
        {#if isPersonal}
          <span class="px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-700 text-[9px] font-bold tracking-wider uppercase">Personal</span>
        {:else}
          <span class="px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[9px] font-bold tracking-wider uppercase">Workspace</span>
        {/if}
      </div>
      
      <span class="text-xs text-slate-500 font-mono mt-0.5">{currentAcc.email}</span>

      <!-- Gemini Plan Badge -->
      <div class="mt-2.5 inline-flex items-center space-x-1.5 px-3 py-1 rounded-full bg-gradient-to-r from-purple-50 via-indigo-50 to-blue-50 text-purple-700 text-[10px] font-semibold border border-purple-200/80 shadow-2xs">
        <Sparkles size={12} class="text-purple-600" />
        <span>
          {isPersonal ? 'Google One AI Premium (Gemini Advanced)' : 'Gemini for Workspace'}
        </span>
      </div>
    {:else}
      <!-- Unlinked State -->
      <div class="w-16 h-16 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center shadow-inner mb-2 ring-4 ring-slate-50">
        <User size={30} />
      </div>

      <div class="flex items-center space-x-1.5">
        <span class="font-semibold text-slate-900 text-sm">Local Profile</span>
        <span class="px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-600 text-[9px] font-bold tracking-wider uppercase">Offline</span>
      </div>

      <span class="text-xs text-slate-400 mt-0.5">No Google account linked</span>

      <button
        class="mt-3 flex items-center space-x-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs shadow-xs transition-colors"
        on:click={() => { dispatch('openSyncModal'); dispatch('close'); }}
      >
        <Cloud size={14} />
        <span>Link Google Account</span>
      </button>
    {/if}
  </div>

  <!-- Storage Quota -->
  {#if currentAcc}
    <div class="py-3 border-b border-slate-100 text-xs">
      <div class="flex items-center justify-between text-slate-600 mb-1.5 font-medium">
        <span class="flex items-center space-x-1">
          <HardDrive size={13} class={isPersonal ? 'text-blue-600' : 'text-emerald-600'} />
          <span>{isPersonal ? 'Google Drive Storage' : 'Workspace Storage'}</span>
        </span>
        <span class="text-slate-900 font-semibold">
          {(currentAcc.driveQuotaUsedMb / 1024).toFixed(1)} GB of {(currentAcc.driveQuotaTotalMb / 1024).toFixed(0)} GB
        </span>
      </div>
      <div class="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
        <div
          class="h-full rounded-full transition-all duration-300 {isPersonal ? 'bg-blue-600' : 'bg-emerald-600'}"
          style="width: {Math.max(6, Math.min(100, Math.round((currentAcc.driveQuotaUsedMb / currentAcc.driveQuotaTotalMb) * 100)))}%;"
        ></div>
      </div>
      <span class="text-[10px] text-slate-400 mt-1 block">
        {isPersonal ? 'Personal Google Drive Cloud Sync Active' : 'Shared Google Workspace Drives Active'}
      </span>
    </div>

    <!-- Account Switcher Section -->
    <div class="py-2.5 border-b border-slate-100">
      <div class="flex items-center justify-between mb-1.5 px-1">
        <span class="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Linked Accounts</span>
        <button
          class="text-[11px] font-semibold text-blue-600 hover:text-blue-700 flex items-center space-x-0.5"
          on:click={() => { dispatch('openSyncModal'); dispatch('close'); }}
        >
          <Plus size={11} />
          <span>Add account</span>
        </button>
      </div>

      <div class="space-y-1">
        {#each accounts as acc}
          {@const isActive = acc.id === currentAcc.id}
          {@const isAccPersonal = acc.accountType === 'personal'}
          <button
            class="w-full flex items-center justify-between px-2.5 py-1.5 rounded-xl text-left transition-colors {isActive ? 'bg-slate-100/90 font-medium' : 'hover:bg-slate-50'}"
            on:click={() => switchActiveAccount(acc)}
          >
            <div class="flex items-center space-x-2.5 truncate">
              <div
                class="w-7 h-7 rounded-full text-white font-bold text-[11px] flex items-center justify-center shrink-0"
                style="background-color: {acc.avatarColor};"
              >
                {acc.name.charAt(0).toUpperCase()}
              </div>
              <div class="truncate">
                <div class="flex items-center space-x-1.5 text-xs text-slate-800">
                  <span class="truncate">{acc.name}</span>
                  {#if isAccPersonal}
                    <span title="Personal Account"><User size={10} class="text-blue-500 shrink-0" /></span>
                  {:else}
                    <span title="Workspace Account"><Building2 size={10} class="text-emerald-600 shrink-0" /></span>
                  {/if}
                </div>
                <span class="text-[10px] text-slate-400 truncate block">{acc.email}</span>
              </div>
            </div>

            {#if isActive}
              <Check size={14} class="text-blue-600 shrink-0 ml-1" />
            {/if}
          </button>
        {/each}
      </div>
    </div>
  {:else}
    <!-- Local Storage Info -->
    <div class="py-3 border-b border-slate-100 text-xs">
      <div class="flex items-center space-x-1.5 text-slate-700 font-semibold mb-1">
        <HardDrive size={13} class="text-slate-600" />
        <span>Local Mac Storage</span>
      </div>
      <p class="text-[11px] text-slate-500 leading-relaxed">
        Documents are saved directly to your local disk storage. Linking a Google account is completely optional for cloud file syncing.
      </p>
    </div>
  {/if}

  <!-- Quick Nav Items -->
  <div class="pt-2 space-y-0.5 text-xs font-medium">
    <button
      class="w-full flex items-center space-x-2.5 px-3 py-2 rounded-xl hover:bg-slate-100 text-slate-700 hover:text-slate-900 transition-colors"
      on:click={() => { dispatch('openDrive'); dispatch('close'); }}
    >
      <FolderKanban size={15} class="text-blue-600" />
      <span>Files & Storage Hub</span>
    </button>

    <button
      class="w-full flex items-center space-x-2.5 px-3 py-2 rounded-xl hover:bg-slate-100 text-slate-700 hover:text-slate-900 transition-colors"
      on:click={() => { dispatch('openSyncModal'); dispatch('close'); }}
    >
      <Cloud size={15} class="text-blue-600" />
      <span>{currentAcc ? 'Google Drive Cloud Sync' : 'Link Google Account'}</span>
    </button>

    <button
      class="w-full flex items-center space-x-2.5 px-3 py-2 rounded-xl hover:bg-slate-100 text-slate-700 hover:text-slate-900 transition-colors"
      on:click={() => { dispatch('openSettings'); dispatch('close'); }}
    >
      <Settings size={15} class="text-slate-600" />
      <span>Preferences & Settings</span>
    </button>

    <button
      class="w-full flex items-center space-x-2.5 px-3 py-2 rounded-xl hover:bg-slate-100 text-slate-700 hover:text-slate-900 transition-colors"
      on:click={() => { dispatch('openShortcuts'); dispatch('close'); }}
    >
      <Keyboard size={15} class="text-slate-600" />
      <span>Keyboard Shortcuts (⌘/)</span>
    </button>

    {#if currentAcc}
      <button
        class="w-full flex items-center space-x-2.5 px-3 py-2 rounded-xl hover:bg-rose-50 text-rose-600 font-medium transition-colors"
        on:click={() => { removeGoogleAccount(currentAcc.id); dispatch('close'); }}
      >
        <LogOut size={15} />
        <span>Unlink Google Account</span>
      </button>
    {/if}
  </div>

  <!-- Footer Policies -->
  <div class="pt-3 mt-2 border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-400">
    <span class="flex items-center space-x-1">
      <ShieldCheck size={11} class="text-emerald-600" />
      <span>Zero-Telemetry & Privacy</span>
    </span>
    <span>Simple Office Suite v1.0</span>
  </div>
</div>
