<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import {
    X,
    Info,
    Mail,
    User,
    Check,
    Lock,
    Building2
  } from '@lucide/svelte';
  import type { CommunicatorUser, UserPresence } from '../../types';
  import { saveCurrentCommunicatorUser } from '../../lib/communicatorStore';

  export let currentUser: CommunicatorUser;

  const dispatch = createEventDispatcher<{
    close: void;
    login: CommunicatorUser;
  }>();

  let emailInput: string = currentUser.email || '';
  let nameInput: string = currentUser.name || '';
  let roleInput: string = currentUser.role || 'Team Member';
  let presenceInput: UserPresence = currentUser.presence || 'online';
  let statusMessageInput: string = currentUser.statusMessage || '';

  $: detectedOrg = getOrgFromEmail(emailInput);

  function getOrgFromEmail(email: string): string {
    if (!email || !email.includes('@')) return 'Demo workspace';
    const domain = email.split('@')[1].toLowerCase();
    return `Demo workspace • ${domain}`;
  }

  function handleLogin() {
    if (!emailInput.trim() || !emailInput.includes('@')) {
      alert('Enter a display email address for the demo identity, for example demo.user@example.com');
      return;
    }

    const initials = (nameInput.trim() || emailInput.split('@')[0])
      .split(' ')
      .map(w => w[0]?.toUpperCase())
      .slice(0, 2)
      .join('') || 'US';

    const updatedUser: CommunicatorUser = {
      id: currentUser.id || `user_${Date.now()}`,
      name: nameInput.trim() || emailInput.split('@')[0],
      email: emailInput.trim(),
      avatar: initials,
      role: roleInput.trim() || 'Team Member',
      presence: presenceInput,
      statusMessage: statusMessageInput.trim() || `Active in ${detectedOrg}`,
      isSelf: true,
    };

    saveCurrentCommunicatorUser(updatedUser);
    dispatch('login', updatedUser);
    dispatch('close');
  }
</script>

<div class="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-4 select-none animate-in fade-in">
  <div class="bg-[#1e2024] text-slate-200 border border-slate-700/80 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col animate-in zoom-in-95">
    
    <!-- Modal Header -->
    <div class="px-5 py-4 bg-[#18191c] border-b border-[#2d3136] flex items-center justify-between">
      <div class="flex items-center space-x-2.5">
        <div class="w-8 h-8 rounded-xl bg-gradient-to-tr from-cyan-600 to-indigo-600 flex items-center justify-center text-white shadow-md">
          <Lock size={16} title="No login, password, or session exists" />
        </div>
        <div>
          <h3 class="font-bold text-sm text-white">Demo Profile</h3>
          <span class="text-[11px] text-cyan-400 font-medium">Local display identity only</span>
        </div>
      </div>

      <button
        class="p-1 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
        on:click={() => dispatch('close')}
      >
        <X size={16} />
      </button>
    </div>

    <!-- Form Body -->
    <div class="p-6 space-y-4 text-xs">
      
      <!-- Email Address Input -->
      <div class="space-y-1.5">
        <label for="comm-email" class="block font-semibold text-slate-300">
          Display Email Address (not sign-in)
        </label>
        <div class="relative">
          <Mail size={14} class="absolute left-3 top-2.5 text-slate-400" />
          <input
            id="comm-email"
            type="email"
            bind:value={emailInput}
            placeholder="e.g. demo.user@example.com"
            class="w-full bg-[#24272c] border border-slate-700 rounded-xl pl-9 pr-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-500 font-sans"
          />
        </div>
        
        <div class="flex items-center space-x-1.5 text-[11px] text-slate-400 pt-0.5">
          <Building2 size={12} class="text-cyan-400" />
          <span>Label:</span>
          <span class="font-semibold text-cyan-300">{detectedOrg}</span>
        </div>
      </div>

      <!-- Display Name Input -->
      <div class="space-y-1.5">
        <label for="comm-name" class="block font-semibold text-slate-300">
          Your Full Name
        </label>
        <div class="relative">
          <User size={14} class="absolute left-3 top-2.5 text-slate-400" />
          <input
            id="comm-name"
            type="text"
            bind:value={nameInput}
            placeholder="Demo User"
            class="w-full bg-[#24272c] border border-slate-700 rounded-xl pl-9 pr-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-500 font-sans"
          />
        </div>
      </div>

      <!-- Role / Title -->
      <div class="space-y-1.5">
        <label for="comm-role" class="block font-semibold text-slate-300">
          Role or Job Title
        </label>
        <input
          id="comm-role"
          type="text"
          bind:value={roleInput}
          placeholder="e.g. Software Engineer, Finance Specialist, Designer"
          class="w-full bg-[#24272c] border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-500 font-sans"
        />
      </div>

      <!-- Presence & Status -->
      <div class="grid grid-cols-2 gap-3 pt-1">
        <div class="space-y-1.5">
          <label for="comm-presence" class="block font-semibold text-slate-300">Presence</label>
          <select
            id="comm-presence"
            bind:value={presenceInput}
            class="w-full bg-[#24272c] border border-slate-700 rounded-xl px-2.5 py-2 text-xs text-white focus:outline-none focus:border-cyan-500"
          >
            <option value="online">🟢 Available</option>
            <option value="busy">🔴 In a Meeting / Busy</option>
            <option value="away">🟡 Away</option>
            <option value="offline">⚪ Invisible</option>
          </select>
        </div>

        <div class="space-y-1.5">
          <label for="comm-status" class="block font-semibold text-slate-300">Status Message</label>
          <input
            id="comm-status"
            type="text"
            bind:value={statusMessageInput}
            placeholder="e.g. In review"
            class="w-full bg-[#24272c] border border-slate-700 rounded-xl px-2.5 py-2 text-xs text-white focus:outline-none focus:border-cyan-500"
          />
        </div>
      </div>

      <div class="p-3 bg-amber-950/40 border border-amber-600/40 rounded-xl flex items-center space-x-2.5 text-amber-100">
        <Info size={20} class="text-amber-300 shrink-0" />
        <div class="text-[11px] leading-relaxed">
          <span class="font-bold text-amber-200 block">Demo login: no account and no network request</span>
          <span>
            The values below only rename the local demo identity. They are stored as plain text in the app profile and
            are never transmitted.
          </span>
        </div>
      </div>

    </div>

    <!-- Modal Footer -->
    <div class="px-6 py-4 bg-[#18191c] border-t border-[#2d3136] flex items-center justify-between">
      <button
        type="button"
        class="px-4 py-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/5 text-xs transition-colors"
        on:click={() => dispatch('close')}
      >
        Cancel
      </button>


      <button
        type="button"
        class="flex items-center space-x-2 px-5 py-2 rounded-xl bg-gradient-to-r from-cyan-600 to-indigo-600 hover:from-cyan-500 hover:to-indigo-500 text-white font-semibold text-xs shadow-lg transition-all"
        on:click={handleLogin}
      >
        <Check size={14} />
        <span>Save Demo Profile</span>
      </button>
    </div>

  </div>
</div>
