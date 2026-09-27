/**
 * A bounded undo/redo history.
 *
 * Storing one full document snapshot per keystroke is what makes editors
 * fragile: a large document multiplied by a fixed entry cap still exhausts
 * memory and eventually takes the tab down. This keeps a byte budget instead
 * of an entry count, so the cost is predictable no matter the document size,
 * and it preserves as much recent history as that budget allows.
 */

export interface HistoryOptions {
  /** Maximum entries retained, regardless of the byte budget. */
  maxEntries?: number;
  /** Approximate budget for retained snapshots, in bytes. */
  maxBytes?: number;
  /** Labels for the entries, newest last. Useful for an undo menu. */
  label?: string;
}

const DEFAULT_MAX_ENTRIES = 100;
const DEFAULT_MAX_BYTES = 32 * 1024 * 1024;

export interface HistoryEntry<T> {
  state: T;
  label: string;
  bytes: number;
  at: number;
}

export class EditHistory<T> {
  private undoStack: HistoryEntry<T>[] = [];
  private redoStack: HistoryEntry<T>[] = [];
  private bytes = 0;
  private readonly maxEntries: number;
  private readonly maxBytes: number;
  private readonly label: string;

  constructor(options: HistoryOptions = {}) {
    this.maxEntries = options.maxEntries ?? DEFAULT_MAX_ENTRIES;
    this.maxBytes = options.maxBytes ?? DEFAULT_MAX_BYTES;
    this.label = options.label ?? 'Edit';
  }

  private sizeOf(state: T): number {
    try {
      return JSON.stringify(state)?.length ?? 0;
    } catch {
      return 0;
    }
  }

  private record(list: HistoryEntry<T>[], state: T) {
    const bytes = this.sizeOf(state);
    list.push({ state, label: this.label, bytes, at: Date.now() });
    this.bytes += bytes;
  }

  /** Records a state to restore on undo. Clears the redo branch. */
  push(state: T) {
    this.record(this.undoStack, state);
    for (const entry of this.redoStack) this.bytes -= entry.bytes;
    this.redoStack = [];
    this.trim();
  }

  /** Returns the previous state, or null when there is nothing to undo. */
  undo(current: T): T | null {
    const entry = this.undoStack.pop();
    if (!entry) return null;
    this.bytes -= entry.bytes;
    this.record(this.redoStack, current);
    return entry.state;
  }

  /** Returns the state that was undone, or null when there is nothing to redo. */
  redo(current: T): T | null {
    const entry = this.redoStack.pop();
    if (!entry) return null;
    this.bytes -= entry.bytes;
    this.record(this.undoStack, current);
    return entry.state;
  }

  /**
   * Swaps the newest snapshot for a newer one, which is how a burst of typing
   * stays a single undo step. If the stack is empty it simply records.
   */
  protected replaceTop(state: T) {
    const top = this.undoStack[this.undoStack.length - 1];
    if (!top) {
      this.record(this.undoStack, state);
      return;
    }
    this.bytes -= top.bytes;
    top.state = state;
    top.bytes = this.sizeOf(state);
    top.at = Date.now();
    this.bytes += top.bytes;
  }

  /** Drops the oldest entries until both stacks fit the budget. */
  private trim() {
    while (this.undoStack.length > this.maxEntries) {
      this.bytes -= this.undoStack.shift()!.bytes;
    }
    while (this.bytes > this.maxBytes && this.undoStack.length > 1) {
      this.bytes -= this.undoStack.shift()!.bytes;
    }
  }

  get canUndo(): boolean {
    return this.undoStack.length > 0;
  }

  get canRedo(): boolean {
    return this.redoStack.length > 0;
  }

  get undoCount(): number {
    return this.undoStack.length;
  }

  get redoCount(): number {
    return this.redoStack.length;
  }

  get byteSize(): number {
    return this.bytes;
  }

  get nextUndoLabel(): string | null {
    return this.undoStack[this.undoStack.length - 1]?.label ?? null;
  }

  clear() {
    this.undoStack = [];
    this.redoStack = [];
    this.bytes = 0;
  }
}

/**
 * Coalesces rapid calls into one history entry so holding a key down does not
 * fill the history with a hundred identical entries. Callers pass a key that
 * identifies the edit, and the entry is replaced while that key repeats.
 */
export class CoalescingHistory<T> extends EditHistory<T> {
  private lastKey: string | null = null;
  private lastAt = 0;

  /**
   * Records an edit, replacing the previous entry when it belongs to the same
   * rapid group. Repeated typing therefore keeps a single undo step that jumps
   * back to the state before the burst started.
   */
  pushCoalesced(state: T, key: string, windowMs = 600) {
    const now = Date.now();
    const withinWindow = this.lastKey === key && now - this.lastAt < windowMs;
    this.lastAt = now;
    this.lastKey = key;

    if (withinWindow) {
      this.replaceTop(state);
    } else {
      this.push(state);
    }
  }

  /** Call before a non-coalescing edit so the previous group is sealed. */
  seal() {
    this.lastKey = null;
  }
}
