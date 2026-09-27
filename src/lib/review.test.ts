import { describe, expect, it } from 'vitest';
import {
  MAX_COMMENT_LENGTH,
  MAX_THREAD_REPLIES,
  MAX_VERSION_SNAPSHOTS,
  addComment,
  createVersion,
  normalizeWatermark,
  removeComment,
  replyToComment,
  reviewId,
  toggleCommentResolved,
} from './review';
import type { DocumentComment, DocumentVersion } from '../types';

const base: DocumentComment = {
  id: 'c1',
  authorName: 'You',
  content: 'first',
  timestamp: '2026-01-01T00:00:00.000Z',
  quotedText: 'quoted',
  resolved: false,
  replies: [],
};

describe('addComment', () => {
  it('appends a thread anchored to a quote', () => {
    const out = addComment([], { text: 'hello', quotedText: 'quoted' });
    expect(out).toHaveLength(1);
    expect(out[0].replies).toEqual([]);
    expect(out[0].resolved).toBe(false);
    expect(out[0].quotedText).toBe('quoted');
  });

  it('ignores blank bodies and empty quotes', () => {
    expect(addComment([base], { text: '   ', quotedText: 'quoted' })).toEqual([base]);
    expect(addComment([base], { text: 'hi', quotedText: '  ' })).toEqual([base]);
  });

  it('truncates oversized bodies instead of storing them', () => {
    const out = addComment([], { text: 'x'.repeat(MAX_COMMENT_LENGTH + 50), quotedText: 'q' });
    expect(out[0].content).toHaveLength(MAX_COMMENT_LENGTH);
  });

  it('defaults the author and can be given a fixed id', () => {
    expect(addComment([], { text: 'a', quotedText: 'q' })[0].authorName).toBe('You');
    expect(addComment([], { text: 'a', quotedText: 'q', id: 'fixed' })[0].id).toBe('fixed');
  });
});

describe('replyToComment', () => {
  it('appends a reply to the matching thread only', () => {
    const other: DocumentComment = { ...base, id: 'c2' };
    const out = replyToComment([base, other], 'c1', { text: 'agreed' });
    expect(out[0].replies).toHaveLength(1);
    expect(out[1].replies).toHaveLength(0);
  });

  it('is a no-op for an unknown thread id', () => {
    expect(replyToComment([base], 'nope', { text: 'x' })).toEqual([base]);
  });

  it('ignores a blank reply', () => {
    expect(replyToComment([base], 'c1', { text: '  ' })).toEqual([base]);
  });

  it('stops growing a thread past the cap', () => {
    const full: DocumentComment = {
      ...base,
      replies: Array.from({ length: MAX_THREAD_REPLIES }, (_, i) => ({
        id: `r${i}`,
        authorName: 'You',
        content: 'x',
        timestamp: '2026-01-01T00:00:00.000Z',
      })),
    };
    expect(replyToComment([full], 'c1', { text: 'more' })[0].replies).toHaveLength(
      MAX_THREAD_REPLIES
    );
  });
});

describe('comment resolution and removal', () => {
  it('toggles resolved and reopens it', () => {
    const resolved = toggleCommentResolved([base], 'c1');
    expect(resolved[0].resolved).toBe(true);
    expect(toggleCommentResolved(resolved, 'c1')[0].resolved).toBe(false);
  });

  it('removes only the targeted thread', () => {
    expect(removeComment([base, { ...base, id: 'c2' }], 'c1').map((c) => c.id)).toEqual(['c2']);
  });
});

describe('createVersion', () => {
  it('puts the newest snapshot first', () => {
    const first = createVersion([], { name: 'draft one', content: '<p>1</p>' });
    const second = createVersion(first, { name: 'draft two', content: '<p>2</p>' });
    expect(second.map((v) => v.name)).toEqual(['draft two', 'draft one']);
  });

  it('marks unnamed snapshots as autosave', () => {
    const out = createVersion([], { content: '<p>x</p>' });
    expect(out[0].isAutoSave).toBe(true);
    expect(out[0].name).toBeUndefined();
  });

  it('caps the number of retained snapshots', () => {
    let versions: DocumentVersion[] = [];
    for (let i = 0; i < MAX_VERSION_SNAPSHOTS + 10; i += 1) {
      versions = createVersion(versions, { name: `v${i}`, content: `<p>${i}</p>` });
    }
    expect(versions).toHaveLength(MAX_VERSION_SNAPSHOTS);
    expect(versions[0].name).toBe(`v${MAX_VERSION_SNAPSHOTS + 9}`);
  });

  it('refuses a non-string body', () => {
    const seeded = createVersion([], { name: 'keep', content: '<p>a</p>' });
    expect(createVersion(seeded, { content: undefined as unknown as string })).toEqual(seeded);
  });
});

describe('normalizeWatermark', () => {
  it('clamps opacity into the supported range', () => {
    expect(normalizeWatermark({ opacity: 0 }).opacity).toBe(0.05);
    expect(normalizeWatermark({ opacity: 9 }).opacity).toBe(0.5);
    expect(normalizeWatermark({ opacity: Number.NaN }).opacity).toBe(0.15);
  });

  it('only allows the two supported angles', () => {
    expect(normalizeWatermark({ angle: 0 }).angle).toBe(0);
    expect(normalizeWatermark({ angle: -45 }).angle).toBe(-45);
    expect(normalizeWatermark({ angle: 12 as unknown as -45 }).angle).toBe(-45);
  });

  it('rejects a colour that is not a hex triple', () => {
    expect(normalizeWatermark({ color: 'red' }).color).toBe('#0f172a');
    expect(normalizeWatermark({ color: '#ff0000' }).color).toBe('#ff0000');
  });

  it('uppercases the text and falls back to a default', () => {
    expect(normalizeWatermark({ text: 'draft' }).text).toBe('DRAFT');
    expect(normalizeWatermark({ text: '   ' }).text).toBe('CONFIDENTIAL');
  });
});

describe('reviewId', () => {
  it('never repeats within a run', () => {
    const ids = new Set(Array.from({ length: 500 }, () => reviewId('c')));
    expect(ids.size).toBe(500);
  });
});
