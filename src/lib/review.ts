/**
 * Review-state helpers for Writer: comments, threads, and version snapshots.
 *
 * These are pure functions on purpose. The same transitions run from the
 * comments drawer, from autosave, and from imported documents, so keeping them
 * out of the component makes the behaviour testable without a DOM.
 */

import type {
  CommentReply,
  DocumentComment,
  DocumentVersion,
  DocumentWatermark,
} from '../types';

export const MAX_COMMENT_LENGTH = 4000;
export const MAX_VERSION_SNAPSHOTS = 50;
export const MAX_THREAD_REPLIES = 100;

export const WATERMARK_OPACITY_RANGE = { min: 0.05, max: 0.5 } as const;
export const WATERMARK_ANGLES = [-45, 0] as const;

let sequence = 0;

/**
 * Ids only need to be unique within one document, so a counter plus a random
 * suffix is enough and avoids pulling in a uuid dependency.
 */
export function reviewId(prefix: string): string {
  sequence += 1;
  const rand = Math.random().toString(36).slice(2, 8);
  return `${prefix}_${Date.now().toString(36)}_${sequence.toString(36)}${rand}`;
}

function clampText(value: unknown, max: number): string {
  if (typeof value !== 'string') return '';
  return value.trim().slice(0, max);
}

export interface NewCommentInput {
  text: string;
  quotedText?: string;
  authorName?: string;
  timestamp?: string;
  id?: string;
}

/** Appends a comment, ignoring blank bodies and empty quotes. */
export function addComment(
  comments: readonly DocumentComment[],
  input: NewCommentInput
): DocumentComment[] {
  const content = clampText(input.text, MAX_COMMENT_LENGTH);
  const quotedText = clampText(input.quotedText, MAX_COMMENT_LENGTH);
  if (!content || !quotedText) return [...comments];

  const comment: DocumentComment = {
    id: input.id ?? reviewId('c'),
    authorName: clampText(input.authorName, 120) || 'You',
    content,
    timestamp: input.timestamp ?? new Date().toISOString(),
    quotedText,
    resolved: false,
    replies: [],
  };
  return [...comments, comment];
}

/** Appends a reply to an existing thread. Unknown ids are a no-op. */
export function replyToComment(
  comments: readonly DocumentComment[],
  commentId: string,
  input: { text: string; authorName?: string; timestamp?: string }
): DocumentComment[] {
  const content = clampText(input.text, MAX_COMMENT_LENGTH);
  if (!content) return [...comments];
  let matched = false;

  const next = comments.map((comment) => {
    if (comment.id !== commentId) return comment;
    matched = true;
    if (comment.replies.length >= MAX_THREAD_REPLIES) return comment;
    const reply: CommentReply = {
      id: reviewId('r'),
      authorName: clampText(input.authorName, 120) || 'You',
      content,
      timestamp: input.timestamp ?? new Date().toISOString(),
    };
    return { ...comment, replies: [...comment.replies, reply] };
  });

  return matched ? next : [...comments];
}

/** Flips the resolved flag, which is how a thread is closed or reopened. */
export function toggleCommentResolved(
  comments: readonly DocumentComment[],
  commentId: string
): DocumentComment[] {
  return comments.map((c) => (c.id === commentId ? { ...c, resolved: !c.resolved } : c));
}

export function removeComment(
  comments: readonly DocumentComment[],
  commentId: string
): DocumentComment[] {
  return comments.filter((c) => c.id !== commentId);
}

export interface NewVersionInput {
  name?: string;
  content: string;
  authorName?: string;
  timestamp?: string;
  id?: string;
}

/**
 * Snapshots are newest-first and capped, so a long editing session cannot grow
 * the document without bound. An unnamed snapshot is treated as autosave.
 */
export function createVersion(
  versions: readonly DocumentVersion[],
  input: NewVersionInput
): DocumentVersion[] {
  if (typeof input.content !== 'string') return [...versions];
  const name = clampText(input.name, 120);
  const version: DocumentVersion = {
    id: input.id ?? reviewId('v'),
    timestamp: input.timestamp ?? new Date().toISOString(),
    authorName: clampText(input.authorName, 120) || 'You',
    content: input.content,
    ...(name ? { name } : { isAutoSave: true }),
  };
  return [version, ...versions].slice(0, MAX_VERSION_SNAPSHOTS);
}

/** Clamps dialog input so a hand-edited value cannot produce invalid styling. */
export function normalizeWatermark(value: Partial<DocumentWatermark>): DocumentWatermark {
  const opacityRaw = typeof value.opacity === 'number' ? value.opacity : 0.15;
  const opacity = Number.isFinite(opacityRaw)
    ? Math.min(
        WATERMARK_OPACITY_RANGE.max,
        Math.max(WATERMARK_OPACITY_RANGE.min, Math.round(opacityRaw * 100) / 100)
      )
    : 0.15;
  const angle = WATERMARK_ANGLES.includes(value.angle as -45 | 0)
    ? (value.angle as -45 | 0)
    : -45;
  const text = clampText(value.text, 60) || 'CONFIDENTIAL';
  const color = /^#[0-9a-fA-F]{6}$/.test(String(value.color ?? '')) ? value.color : '#0f172a';
  return {
    enabled: value.enabled === true,
    text: text.toUpperCase(),
    opacity,
    angle,
    color,
  };
}
