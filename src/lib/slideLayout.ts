import type { SlideElement } from '../types';

export type AlignPosition = 'left' | 'centerH' | 'right' | 'top' | 'centerV' | 'bottom';

const MARGIN = 8;

/**
 * Returns a copy of the element moved to a slide-relative alignment position.
 * Geometry is percentage based, so the result scales with any aspect ratio.
 */
export function alignElementBox(
  element: Pick<SlideElement, 'x' | 'y' | 'width' | 'height'>,
  position: AlignPosition,
  margin: number = MARGIN
): Pick<SlideElement, 'x' | 'y'> {
  switch (position) {
    case 'left':
      return { x: margin, y: element.y };
    case 'centerH':
      return { x: Math.max(0, (100 - element.width) / 2), y: element.y };
    case 'right':
      return { x: Math.max(0, 100 - element.width - margin), y: element.y };
    case 'top':
      return { x: element.x, y: margin };
    case 'centerV':
      return { x: element.x, y: Math.max(0, (100 - element.height) / 2) };
    case 'bottom':
      return { x: element.x, y: Math.max(0, 100 - element.height - margin) };
    default:
      return { x: element.x, y: element.y };
  }
}

export const TRANSITIONS = ['none', 'fade', 'slide', 'zoom'] as const;
export type Transition = (typeof TRANSITIONS)[number];

export function normalizeTransition(name: string): Transition {
  return (TRANSITIONS as readonly string[]).includes(name) ? (name as Transition) : 'none';
}
