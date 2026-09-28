import { describe, expect, it } from 'vitest';
import { resolveTheme } from './theme';

describe('resolveTheme', () => {
  it('uses an explicit preference regardless of the OS setting', () => {
    expect(resolveTheme('dark', true)).toBe('dark');
    expect(resolveTheme('dark', false)).toBe('dark');
    expect(resolveTheme('light', true)).toBe('light');
    expect(resolveTheme('light', false)).toBe('light');
  });

  it('follows the OS when set to system', () => {
    expect(resolveTheme('system', true)).toBe('dark');
    expect(resolveTheme('system', false)).toBe('light');
  });

  it('falls back to system for unknown or missing preferences', () => {
    expect(resolveTheme(undefined, true)).toBe('dark');
    expect(resolveTheme(undefined, false)).toBe('light');
    expect(resolveTheme(null, true)).toBe('dark');
    expect(resolveTheme('sepia', true)).toBe('dark');
    expect(resolveTheme('', false)).toBe('light');
    expect(resolveTheme(42, false)).toBe('light');
  });

  it('never returns an unresolved value', () => {
    for (const preference of ['dark', 'light', 'system', undefined, 'nonsense']) {
      for (const prefersDark of [true, false]) {
        expect(['dark', 'light']).toContain(resolveTheme(preference, prefersDark));
      }
    }
  });
});
