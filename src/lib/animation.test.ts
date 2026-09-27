import { describe, it, expect } from 'vitest';
import {
  animationName,
  animationStyle,
  buildAnimationOrder,
  normalizeAnimation,
  normalizePreset,
  DEFAULT_ANIMATION,
  MAX_DELAY_MS,
  MAX_DURATION_MS,
} from './animation';

describe('normalizePreset', () => {
  it('accepts known presets and rejects anything else', () => {
    expect(normalizePreset('fade')).toBe('fade');
    expect(normalizePreset('slideUp')).toBe('slideUp');
    expect(normalizePreset('explode')).toBe('none');
    expect(normalizePreset('')).toBe('none');
  });
});

describe('normalizeAnimation', () => {
  it('defaults to no animation', () => {
    expect(normalizeAnimation(undefined)).toEqual({
      preset: 'none',
      delayMs: 0,
      durationMs: DEFAULT_ANIMATION.durationMs,
      autoPlay: false,
    });
  });

  it('clamps delay and duration into safe bounds', () => {
    expect(normalizeAnimation({ delayMs: -50, durationMs: 10 }).delayMs).toBe(0);
    expect(normalizeAnimation({ delayMs: 10 ** 9 }).delayMs).toBe(MAX_DELAY_MS);
    expect(normalizeAnimation({ durationMs: 10 ** 9 }).durationMs).toBe(MAX_DURATION_MS);
  });

  it('ignores NaN and non-numeric values', () => {
    const a = normalizeAnimation({ delayMs: Number.NaN, durationMs: undefined });
    expect(a.delayMs).toBe(0);
    expect(a.durationMs).toBe(DEFAULT_ANIMATION.durationMs);
  });
});

describe('animation css', () => {
  it('produces no animation for none', () => {
    expect(animationName('none')).toBeNull();
    expect(animationStyle({ preset: 'none', delayMs: 0, durationMs: 400, autoPlay: false })).toBe('');
  });

  it('kebab-cases the preset into a css name', () => {
    expect(animationName('slideUp')).toBe('anim-slide-up');
    expect(animationName('zoom')).toBe('anim-zoom');
  });

  it('emits a single run by default and repeats when auto-playing', () => {
    const once = animationStyle({ preset: 'fade', delayMs: 100, durationMs: 300, autoPlay: false });
    expect(once).toBe('animation: anim-fade 300ms normal 1 100ms both;');
    const loop = animationStyle({ preset: 'fade', delayMs: 0, durationMs: 300, autoPlay: true });
    expect(loop).toBe('animation: anim-fade 300ms alternate infinite 0ms both;');
  });
});

describe('buildAnimationOrder', () => {
  it('puts auto-playing elements first, ordered by delay', () => {
    const order = buildAnimationOrder([
      { id: 'a' },
      { id: 'b', animation: { preset: 'fade', delayMs: 500, durationMs: 300, autoPlay: true } },
      { id: 'c', animation: { preset: 'fade', delayMs: 100, durationMs: 300, autoPlay: true } },
    ]);
    expect(order).toEqual(['c', 'b', 'a']);
  });

  it('keeps document order within the same group', () => {
    const order = buildAnimationOrder([{ id: 'a' }, { id: 'b' }, { id: 'c' }]);
    expect(order).toEqual(['a', 'b', 'c']);
  });

  it('handles an empty slide', () => {
    expect(buildAnimationOrder([])).toEqual([]);
  });
});
