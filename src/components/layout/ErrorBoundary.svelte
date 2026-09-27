<script lang="ts">
  import { onMount, createEventDispatcher } from 'svelte';

  /**
   * Catches render and runtime failures below it so one bad document shows a
   * recovery screen instead of a blank window, and keeps the rest of the shell
   * usable. Svelte has no built-in boundary, so this wraps the subtree in an
   * error handler and re-mounts on demand.
   */
  const dispatch = createEventDispatcher<{ recover: void; reset: void }>();

  let failed = false;
  let message = '';

  export function reset() {
    failed = false;
    message = '';
  }

  function record(reason: unknown) {
    failed = true;
    message =
      reason instanceof Error
        ? reason.message || 'Something went wrong.'
        : typeof reason === 'string'
          ? reason
          : 'Something went wrong.';
    console.error('Workspace failure:', reason);
  }

  onMount(() => {
    const onGlobal = (e: ErrorEvent) => record(e.error ?? e.message);
    const onRejection = (e: PromiseRejectionEvent) => record(e.reason);
    window.addEventListener('error', onGlobal);
    window.addEventListener('unhandledrejection', onRejection);
    return () => {
      window.removeEventListener('error', onGlobal);
      window.removeEventListener('unhandledrejection', onRejection);
    };
  });
</script>

{#if failed}
  <div class="flex-1 flex items-center justify-center p-6 bg-slate-100" role="alert">
    <div class="max-w-md w-full rounded-xl border border-slate-200 bg-white p-6 shadow-sm text-slate-700">
      <h2 class="text-base font-semibold text-slate-900">This workspace stopped responding</h2>
      <p class="mt-2 text-xs leading-relaxed text-slate-600">
        Your work is kept in the autosave snapshot, so nothing has been lost.
      </p>
      {#if message}
        <p class="mt-3 rounded-md bg-slate-50 px-3 py-2 font-mono text-[11px] text-slate-600 break-words">
          {message}
        </p>
      {/if}
      <div class="mt-5 flex items-center gap-2">
        <button
          class="px-3 py-1.5 rounded-md bg-slate-900 text-white text-xs font-medium hover:bg-slate-700"
          on:click={() => dispatch('recover')}
        >
          Reload workspace
        </button>
        <button
          class="px-3 py-1.5 rounded-md border border-slate-300 text-xs font-medium hover:bg-slate-50"
          on:click={reset}
        >
          Dismiss
        </button>
      </div>
    </div>
  </div>
{:else}
  <slot />
{/if}
