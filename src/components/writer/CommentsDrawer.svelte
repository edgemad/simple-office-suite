<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import type { DocumentComment, EditorMode } from '../../types';
  import {
    MessageSquare,
    X,
    Check,
    Send,
    CornerDownRight,
    Filter,
    Edit3,
    Eye,
    Sparkles,
    Trash2
  } from 'lucide-svelte';

  export let isOpen: boolean = false;
  export let comments: DocumentComment[] = [];
  export let editorMode: EditorMode = 'editing';
  export let selectedQuote: string = '';

  const dispatch = createEventDispatcher<{
    close: void;
    addComment: { text: string; quotedText: string };
    replyComment: { commentId: string; text: string };
    resolveComment: { commentId: string };
    deleteComment: { commentId: string };
    changeMode: { mode: EditorMode };
    focusComment: { commentId: string };
  }>();

  let newCommentText = '';
  let replyTexts: Record<string, string> = {};
  let filter: 'open' | 'resolved' | 'all' = 'open';

  $: filteredComments = comments.filter((c) => {
    if (filter === 'open') return !c.resolved;
    if (filter === 'resolved') return c.resolved;
    return true;
  });

  function handleCreateComment() {
    if (!newCommentText.trim()) return;
    dispatch('addComment', {
      text: newCommentText.trim(),
      quotedText: selectedQuote,
    });
    newCommentText = '';
    selectedQuote = '';
  }

  function handleReply(commentId: string) {
    const text = replyTexts[commentId]?.trim();
    if (!text) return;
    dispatch('replyComment', { commentId, text });
    replyTexts[commentId] = '';
  }
</script>

{#if isOpen}
  <aside class="w-80 border-l border-slate-200 bg-white flex flex-col h-full shadow-lg z-20 animate-in slide-in-from-right duration-200">
    <!-- Drawer Header -->
    <div class="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
      <div class="flex items-center space-x-2">
        <MessageSquare size={16} class="text-blue-600" />
        <span class="font-bold text-sm text-slate-800">Comments & Review</span>
        <span class="text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full font-bold">
          {comments.filter(c => !c.resolved).length}
        </span>
      </div>
      <button
        class="p-1 rounded-full hover:bg-slate-200 text-slate-400 hover:text-slate-700 transition-colors"
        on:click={() => dispatch('close')}
        title="Close Drawer"
      >
        <X size={16} />
      </button>
    </div>

    <!-- Mode Selector: Editing vs Suggesting vs Viewing (Google Docs Style) -->
    <div class="px-4 py-2.5 bg-slate-100/70 border-b border-slate-200 flex items-center justify-between text-xs">
      <span class="text-slate-500 font-medium">Mode:</span>
      <div class="flex bg-white rounded-lg p-0.5 border border-slate-200 shadow-2xs">
        <button
          class="flex items-center space-x-1 px-2 py-1 rounded text-xs transition-colors {editorMode === 'editing'
            ? 'bg-blue-600 text-white font-semibold'
            : 'text-slate-600 hover:bg-slate-100'}"
          on:click={() => dispatch('changeMode', { mode: 'editing' })}
          title="Edit document directly"
        >
          <Edit3 size={11} />
          <span>Editing</span>
        </button>
        <button
          class="flex items-center space-x-1 px-2 py-1 rounded text-xs transition-colors {editorMode === 'suggesting'
            ? 'bg-emerald-600 text-white font-semibold'
            : 'text-slate-600 hover:bg-slate-100'}"
          on:click={() => dispatch('changeMode', { mode: 'suggesting' })}
          title="Edits become suggestions"
        >
          <Sparkles size={11} />
          <span>Suggesting</span>
        </button>
        <button
          class="flex items-center space-x-1 px-2 py-1 rounded text-xs transition-colors {editorMode === 'viewing'
            ? 'bg-slate-700 text-white font-semibold'
            : 'text-slate-600 hover:bg-slate-100'}"
          on:click={() => dispatch('changeMode', { mode: 'viewing' })}
          title="Read or print final document"
        >
          <Eye size={11} />
          <span>Viewing</span>
        </button>
      </div>
    </div>

    <!-- Add New Comment Box -->
    <div class="p-3 border-b border-slate-200 bg-white">
      {#if selectedQuote}
        <div class="mb-2 p-2 bg-amber-50 border-l-2 border-amber-400 rounded-r text-[11px] text-slate-700 italic">
          "{selectedQuote}"
        </div>
      {/if}
      <div class="relative">
        <textarea
          placeholder="Add a comment or feedback..."
          bind:value={newCommentText}
          rows="2"
          class="w-full text-xs p-2.5 rounded-lg border border-slate-200 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none resize-none bg-slate-50/50"
          on:keydown={(e) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') handleCreateComment();
          }}
        ></textarea>
        <div class="flex items-center justify-between mt-1">
          <span class="text-[10px] text-slate-400">Press Cmd+Enter to post</span>
          <button
            class="flex items-center space-x-1 px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-2xs transition-colors disabled:opacity-40"
            disabled={!newCommentText.trim()}
            on:click={handleCreateComment}
          >
            <Send size={11} />
            <span>Comment</span>
          </button>
        </div>
      </div>
    </div>

    <!-- Filter Toggle -->
    <div class="px-4 py-2 bg-slate-50 border-b border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
      <span class="font-medium">Filter:</span>
      <div class="flex space-x-1">
        <button
          class="px-2 py-0.5 rounded font-medium transition-colors {filter === 'open' ? 'bg-white text-blue-600 shadow-2xs font-bold' : 'hover:text-slate-800'}"
          on:click={() => (filter = 'open')}
        >
          Open ({comments.filter((c) => !c.resolved).length})
        </button>
        <button
          class="px-2 py-0.5 rounded font-medium transition-colors {filter === 'resolved' ? 'bg-white text-blue-600 shadow-2xs font-bold' : 'hover:text-slate-800'}"
          on:click={() => (filter = 'resolved')}
        >
          Resolved ({comments.filter((c) => c.resolved).length})
        </button>
        <button
          class="px-2 py-0.5 rounded font-medium transition-colors {filter === 'all' ? 'bg-white text-blue-600 shadow-2xs font-bold' : 'hover:text-slate-800'}"
          on:click={() => (filter = 'all')}
        >
          All
        </button>
      </div>
    </div>

    <!-- Comments List -->
    <div class="flex-1 overflow-y-auto p-3 space-y-3 bg-slate-50/40">
      {#if filteredComments.length === 0}
        <div class="py-12 text-center text-slate-400 text-xs">
          <MessageSquare size={32} class="mx-auto mb-2 opacity-30 text-slate-400" />
          <p>No {filter} comments found.</p>
          <p class="text-[10px] mt-1 text-slate-400">Select text in document to comment on it.</p>
        </div>
      {:else}
        {#each filteredComments as comment (comment.id)}
          <div
            class="bg-white rounded-xl border p-3 text-xs shadow-2xs transition-all {comment.resolved
              ? 'opacity-65 border-slate-200'
              : 'border-slate-200 hover:border-blue-300 hover:shadow-xs'}"
          >
            <!-- Author & Actions -->
            <div class="flex items-center justify-between mb-1.5">
              <div class="flex items-center space-x-2">
                <div class="w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-[10px]">
                  {comment.authorName.charAt(0).toUpperCase()}
                </div>
                <div>
                  <div class="font-bold text-slate-800 text-[11px] leading-tight">{comment.authorName}</div>
                  <div class="text-[9px] text-slate-400">
                    {new Date(comment.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
              </div>

              <div class="flex items-center space-x-1">
                <button
                  class="p-1 rounded hover:bg-emerald-50 text-slate-400 hover:text-emerald-600 transition-colors"
                  on:click={() => dispatch('resolveComment', { commentId: comment.id })}
                  title={comment.resolved ? 'Reopen comment' : 'Resolve and close'}
                >
                  <Check size={14} class={comment.resolved ? 'text-emerald-600' : ''} />
                </button>
                <button
                  class="p-1 rounded hover:bg-rose-50 text-slate-400 hover:text-rose-600 transition-colors"
                  on:click={() => dispatch('deleteComment', { commentId: comment.id })}
                  title="Delete comment thread"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            </div>

            <!-- Quoted Anchor Text -->
            {#if comment.quotedText}
              <div class="mb-2 p-1.5 bg-amber-50 border-l-2 border-amber-400 rounded-r text-[10px] text-slate-600 italic">
                "{comment.quotedText}"
              </div>
            {/if}

            <!-- Comment Body -->
            <div class="text-slate-800 text-xs mb-2 leading-relaxed">
              {comment.content}
            </div>

            <!-- Replies Thread -->
            {#if comment.replies && comment.replies.length > 0}
              <div class="pl-2 border-l border-slate-100 space-y-2 mb-2">
                {#each comment.replies as reply (reply.id)}
                  <div class="bg-slate-50 p-2 rounded-lg text-[11px]">
                    <div class="flex items-center justify-between text-slate-600 font-semibold mb-0.5">
                      <span>{reply.authorName}</span>
                      <span class="text-[9px] text-slate-400 font-normal">
                        {new Date(reply.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <div class="text-slate-700">{reply.content}</div>
                  </div>
                {/each}
              </div>
            {/if}

            <!-- Reply Box -->
            {#if !comment.resolved}
              <div class="pt-2 border-t border-slate-100 flex items-center space-x-1.5">
                <CornerDownRight size={12} class="text-slate-400 shrink-0" />
                <input
                  type="text"
                  placeholder="Reply..."
                  bind:value={replyTexts[comment.id]}
                  class="flex-1 text-[11px] px-2 py-1 bg-slate-50 border border-slate-200 rounded-md outline-none focus:border-blue-500"
                  on:keydown={(e) => {
                    if (e.key === 'Enter') handleReply(comment.id);
                  }}
                />
                <button
                  class="px-2 py-1 bg-slate-200 hover:bg-blue-600 hover:text-white rounded text-[10px] font-semibold text-slate-700 transition-colors"
                  on:click={() => handleReply(comment.id)}
                >
                  Reply
                </button>
              </div>
            {/if}
          </div>
        {/each}
      {/if}
    </div>
  </aside>
{/if}
