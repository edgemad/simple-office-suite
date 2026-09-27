/**
 * Per-element entrance animations for slides.
 *
 * The model is deliberately declarative: an element stores a preset, a delay
 * and a duration, and the canvas turns that into CSS. Keeping the arithmetic
 * here means the timing rules are testable and the slide markup stays simple.
 */

export const ANIMATION_PRESETS = [
  'none',
  'fade',
  'slideUp',
  'slideDown',
  'slideLeft',
  'slideRight',
  'zoom',
  'pop',
] as const;

export type AnimationPreset = (typeof ANIMATION_PRESETS)[number];

export interface ElementAnimation {
  preset: AnimationPreset;
  /** Milliseconds to wait before the element appears. */
  delayMs: number;
  /** Milliseconds the animation runs for. */
  durationMs: number;
  /** Whether the animation repeats for the life of the slide. */
  autoPlay: boolean;
}

export const DEFAULT_ANIMATION: ElementAnimation = {
  preset: 'fade',
  delayMs: 0,
  durationMs: 400,
  autoPlay: false,
};

export const MAX_DELAY_MS = 10_000;
export const MAX_DURATION_MS = 5_000;

export function normalizePreset(name: string): AnimationPreset {
  return (ANIMATION_PRESETS as readonly string[]).includes(name) ? (name as AnimationPreset) : 'none';
}

/**
 * Accepts loose input on purpose: the preset arrives from a hand-editable deck,
 * so it is typed as a plain string and narrowed here rather than at every call.
 */
export function normalizeAnimation(
  value: { preset?: string; delayMs?: number; durationMs?: number; autoPlay?: boolean } | undefined,
): ElementAnimation {
  const preset = value?.preset ? normalizePreset(value.preset) : 'none';
  const delayMs = clamp(value?.delayMs, 0, MAX_DELAY_MS, 0);
  const durationMs = clamp(value?.durationMs, 100, MAX_DURATION_MS, DEFAULT_ANIMATION.durationMs);
  return { preset, delayMs, durationMs, autoPlay: value?.autoPlay === true };
}

function clamp(value: number | undefined, min: number, max: number, fallback: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(min, Math.round(value)));
}

/** CSS animation name for a preset, or null when nothing should animate. */
export function animationName(preset: AnimationPreset): string | null {
  return preset === 'none' ? null : `anim-${kebab(preset)}`;
}

function kebab(value: string): string {
  return value.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);
}

/** The inline style that runs an element's animation, or '' when idle. */
export function animationStyle(animation: ElementAnimation | undefined): string {
  const a = normalizeAnimation(animation);
  const name = animationName(a.preset);
  if (!name) return '';
  const iterations = a.autoPlay ? 'infinite' : '1';
  const direction = a.autoPlay ? 'alternate' : 'normal';
  return `animation: ${name} ${a.durationMs}ms ${direction} ${iterations} ${a.delayMs}ms both;`;
}

/**
 * The order elements appear in, which is what PowerPoint's animation pane
 * shows: every auto-playing element by delay, then the rest by document order.
 */
export function buildAnimationOrder(
  elements: Array<{ id: string; animation?: ElementAnimation }>
): string[] {
  return elements
    .map((element, index) => {
      const a = normalizeAnimation(element.animation);
      return { id: element.id, index, auto: a.autoPlay, delay: a.delayMs };
    })
    .sort((a, b) => {
      if (a.auto !== b.auto) return a.auto ? -1 : 1;
      if (a.auto && a.delay !== b.delay) return a.delay - b.delay;
      return a.index - b.index;
    })
    .map((entry) => entry.id);
}
