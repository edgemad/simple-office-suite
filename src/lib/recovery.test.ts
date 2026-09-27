import { describe, it, expect } from 'vitest';
import { evaluateRecovery, describeSnapshot, MAX_RECOVERY_AGE_MS } from './recovery';
import type { AutoSavePayload } from './storage';

const HOUR = 60 * 60 * 1000;
const NOW = Date.parse('2026-03-01T12:00:00.000Z');

const snapshot = (timestamp: string, data: unknown = { meta: { title: 'Budget' } }): AutoSavePayload => ({
  id: 'doc_1',
  module: 'writer',
  timestamp,
  data,
});

describe('evaluateRecovery', () => {
  it('does nothing without a snapshot', () => {
    const decision = evaluateRecovery(null, {}, NOW);
    expect(decision.shouldOffer).toBe(false);
    expect(decision.reason).toBe('no-snapshot');
  });

  it('rejects a snapshot with an unreadable timestamp', () => {
    expect(evaluateRecovery(snapshot('not a date'), {}, NOW).reason).toBe('invalid-snapshot');
  });

  it('offers unsaved work even when the snapshot is old', () => {
    const decision = evaluateRecovery(snapshot('2026-02-01T12:00:00.000Z'), {}, NOW);
    expect(decision.shouldOffer).toBe(true);
    expect(decision.reason).toBe('recover-unsaved');
  });

  it('offers a snapshot newer than the last real save', () => {
    const decision = evaluateRecovery(
      snapshot('2026-03-01T11:50:00.000Z'),
      { lastSavedAt: '2026-03-01T11:00:00.000Z' },
      NOW,
    );
    expect(decision.shouldOffer).toBe(true);
    expect(decision.reason).toBe('recover-newer-than-save');
  });

  it('stays quiet when the snapshot is older than the saved file', () => {
    const decision = evaluateRecovery(
      snapshot('2026-03-01T10:00:00.000Z'),
      { lastSavedAt: '2026-03-01T11:00:00.000Z' },
      NOW,
    );
    expect(decision.shouldOffer).toBe(false);
    expect(decision.reason).toBe('already-saved');
  });

  it('tolerates sub-second clock skew between snapshot and save', () => {
    const decision = evaluateRecovery(
      snapshot('2026-03-01T11:00:00.500Z'),
      { lastSavedAt: '2026-03-01T11:00:00.000Z' },
      NOW,
    );
    expect(decision.shouldOffer).toBe(false);
  });

  it('never nags after the user declines', () => {
    const decision = evaluateRecovery(snapshot('2026-03-01T11:50:00.000Z'), { dismissed: true }, NOW);
    expect(decision.shouldOffer).toBe(false);
    expect(decision.reason).toBe('dismissed');
  });

  it('ignores a stale draft of an already saved document', () => {
    const decision = evaluateRecovery(
      snapshot(new Date(NOW - MAX_RECOVERY_AGE_MS - HOUR).toISOString()),
      { lastSavedAt: '2026-03-01T11:00:00.000Z' },
      NOW,
    );
    expect(decision.shouldOffer).toBe(false);
    expect(decision.reason).toBe('stale');
  });

  it('names the document in the prompt', () => {
    expect(evaluateRecovery(snapshot('2026-03-01T11:50:00.000Z'), {}, NOW).label).toBe('Recover "Budget"?');
  });

  it('falls back to a generic prompt when the title is missing', () => {
    const decision = evaluateRecovery(snapshot('2026-03-01T11:50:00.000Z', { cells: {} }), {}, NOW);
    expect(decision.label).toBe('Recover unsaved changes?');
  });
});

describe('describeSnapshot', () => {
  it('summarizes a writer document', () => {
    expect(describeSnapshot({ wordCount: 812 })).toBe('812 words');
  });

  it('summarizes a workbook', () => {
    expect(describeSnapshot({ sheets: [{ cells: { A1: {}, A2: {} } }, { cells: {} }] })).toBe('2 sheets, 2 cells');
  });

  it('summarizes a deck', () => {
    expect(describeSnapshot({ slides: [{}, {}, {}] })).toBe('3 slides');
  });

  it('degrades gracefully for junk', () => {
    expect(describeSnapshot(null)).toBe('Unknown document');
    expect(describeSnapshot({})).toBe('Document');
  });
});
