import type { AutoSavePayload } from './storage';

/**
 * Decides whether a stored autosave snapshot should be offered back to the
 * user. Recovery that appears when there is nothing to recover, or stays
 * hidden when a real crash lost work, is worse than no recovery at all, so the
 * rules live here where they can be tested.
 */

export interface SnapshotState {
  /** When the document was last written to its real file. */
  lastSavedAt?: string | null;
  /** The document's file path, or null for an unsaved document. */
  filePath?: string | null;
  /** Set once the user explicitly declines or accepts a recovery. */
  dismissed?: boolean;
}

export interface RecoveryDecision {
  shouldOffer: boolean;
  reason:
    | 'recover-unsaved'
    | 'recover-newer-than-save'
    | 'already-saved'
    | 'stale'
    | 'dismissed'
    | 'invalid-snapshot'
    | 'no-snapshot';
  /** Unsaved work older than this is treated as noise rather than a crash. */
  ageMs: number;
  label: string;
}

/** Snapshots older than this are ignored so old drafts never nag. */
export const MAX_RECOVERY_AGE_MS = 14 * 24 * 60 * 60 * 1000;

export function evaluateRecovery(
  snapshot: AutoSavePayload | null,
  state: SnapshotState,
  now: number = Date.now()
): RecoveryDecision {
  if (!snapshot || typeof snapshot.timestamp !== 'string' || !snapshot.data) {
    return { shouldOffer: false, reason: 'no-snapshot', ageMs: 0, label: '' };
  }

  const stamp = Date.parse(snapshot.timestamp);
  if (Number.isNaN(stamp)) {
    return { shouldOffer: false, reason: 'invalid-snapshot', ageMs: 0, label: '' };
  }

  const ageMs = Math.max(0, now - stamp);
  const title = readTitle(snapshot.data);
  const label = title ? `Recover "${title}"?` : 'Recover unsaved changes?';

  if (state.dismissed) {
    return { shouldOffer: false, reason: 'dismissed', ageMs, label };
  }

  const savedAt = state.lastSavedAt ? Date.parse(state.lastSavedAt) : NaN;
  if (Number.isNaN(savedAt)) {
    // Never written to a file, so this snapshot is the only copy of the work.
    // Age is ignored here on purpose: a false prompt costs one dismissed
    // dialog, whereas suppressing it would throw away the user's document.
    return { shouldOffer: true, reason: 'recover-unsaved', ageMs, label };
  }

  // A saved copy exists, so an old draft is noise rather than lost work.
  if (ageMs > MAX_RECOVERY_AGE_MS) {
    return { shouldOffer: false, reason: 'stale', ageMs, label };
  }

  if (stamp > savedAt + 1000) {
    return { shouldOffer: true, reason: 'recover-newer-than-save', ageMs, label };
  }

  return { shouldOffer: false, reason: 'already-saved', ageMs, label };
}

function readTitle(data: unknown): string {
  if (!data || typeof data !== 'object') return '';
  const meta = (data as { meta?: unknown }).meta;
  if (meta && typeof meta === 'object' && typeof (meta as { title?: unknown }).title === 'string') {
    return String((meta as { title: string }).title).slice(0, 80);
  }
  return '';
}

/** A short human summary of how much work a snapshot represents. */
export function describeSnapshot(data: unknown): string {
  if (!data || typeof data !== 'object') return 'Unknown document';
  const d = data as Record<string, unknown>;
  const words = typeof d.wordCount === 'number' ? d.wordCount : null;
  if (words !== null) return `${words} words`;
  if (Array.isArray(d.cells)) return `${d.cells.length} cells`;
  if (Array.isArray(d.sheets)) {
    const cells = (d.sheets as Array<{ cells?: Record<string, unknown> }>).reduce(
      (sum, sh) => sum + Object.keys(sh?.cells ?? {}).length,
      0,
    );
    return `${(d.sheets as unknown[]).length} sheets, ${cells} cells`;
  }
  if (Array.isArray(d.slides)) return `${(d.slides as unknown[]).length} slides`;
  return 'Document';
}
