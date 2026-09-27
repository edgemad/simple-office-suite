import { describe, it, expect } from 'vitest';
import { EditHistory, CoalescingHistory } from './history';

describe('EditHistory', () => {
  it('returns null when there is nothing to undo or redo', () => {
    const h = new EditHistory<{ v: number }>();
    expect(h.undo({ v: 1 })).toBeNull();
    expect(h.redo({ v: 1 })).toBeNull();
    expect(h.canUndo).toBe(false);
    expect(h.canRedo).toBe(false);
  });

  it('undoes and redoes in order', () => {
    const h = new EditHistory<{ v: number }>();
    h.push({ v: 1 });
    h.push({ v: 2 });
    expect(h.undo({ v: 3 })).toEqual({ v: 2 });
    expect(h.undo({ v: 2 })).toEqual({ v: 1 });
    expect(h.redo({ v: 1 })).toEqual({ v: 2 });
    expect(h.redo({ v: 2 })).toEqual({ v: 3 });
  });

  it('clears the redo branch when a new edit is pushed', () => {
    const h = new EditHistory<{ v: number }>();
    h.push({ v: 1 });
    h.undo({ v: 2 });
    expect(h.canRedo).toBe(true);
    h.push({ v: 9 });
    expect(h.canRedo).toBe(false);
  });

  it('keeps at most maxEntries snapshots', () => {
    const h = new EditHistory<{ v: number }>({ maxEntries: 3 });
    for (let i = 0; i < 10; i += 1) h.push({ v: i });
    expect(h.undoCount).toBe(3);
  });

  it('bounds memory by bytes rather than entry count', () => {
    // Each entry is ~20 bytes of JSON, so a small budget keeps very few.
    const h = new EditHistory<string>({ maxEntries: 1000, maxBytes: 120 });
    for (let i = 0; i < 50; i += 1) h.push(`value-${i}`.padEnd(20, 'x'));
    expect(h.byteSize).toBeLessThanOrEqual(120);
    expect(h.undoCount).toBeLessThan(50);
  });

  it('never drops the only snapshot, however large it is', () => {
    const h = new EditHistory<string>({ maxEntries: 1, maxBytes: 1 });
    h.push('a'.repeat(500));
    expect(h.undoCount).toBe(1);
    expect(h.canUndo).toBe(true);
  });

  it('reports the label of the next undo', () => {
    const h = new EditHistory<number>({ label: 'Bold' });
    h.push(1);
    expect(h.nextUndoLabel).toBe('Bold');
    h.undo(2);
    expect(h.nextUndoLabel).toBeNull();
  });

  it('survives a state that cannot be serialized', () => {
    const cyclic: Record<string, unknown> = {};
    cyclic.self = cyclic;
    const h = new EditHistory<Record<string, unknown>>();
    expect(() => h.push(cyclic)).not.toThrow();
    expect(h.undo({})).toEqual(cyclic);
  });

  it('clears both stacks', () => {
    const h = new EditHistory<number>();
    h.push(1);
    h.undo(2);
    h.clear();
    expect(h.canUndo).toBe(false);
    expect(h.canRedo).toBe(false);
    expect(h.byteSize).toBe(0);
  });
});

describe('CoalescingHistory', () => {
  it('seals a group when a different edit key arrives', () => {
    const h = new CoalescingHistory<{ v: number }>();
    h.pushCoalesced({ v: 1 }, 'typing');
    h.pushCoalesced({ v: 2 }, 'typing');
    expect(h.undoCount).toBe(1);
    h.pushCoalesced({ v: 3 }, 'paste');
    expect(h.undoCount).toBe(2);
  });

  it('starts a new group after the coalescing window', () => {
    const h = new CoalescingHistory<{ v: number }>();
    h.pushCoalesced({ v: 1 }, 'typing', 600);
    h.pushCoalesced({ v: 2 }, 'typing', 0);
    expect(h.undoCount).toBe(2);
  });

  it('seal forces the next edit into a new group', () => {
    const h = new CoalescingHistory<{ v: number }>();
    h.pushCoalesced({ v: 1 }, 'typing');
    h.seal();
    h.pushCoalesced({ v: 2 }, 'typing');
    expect(h.undoCount).toBe(2);
  });
});
