/**
 * Theme resolution and application.
 *
 * `AppSettings.theme` already stored 'dark' | 'light' | 'system', but nothing
 * ever read it — picking a theme in Settings did nothing. This resolves the
 * preference against the OS and reflects it onto <html data-theme>, which the
 * liquid-glass tokens key off.
 *
 * The resolver is pure so it can be tested without a DOM; only `applyTheme`
 * touches `document`.
 */

import type { AppSettings } from '../types';

export type ThemePreference = AppSettings['theme'];
export type ResolvedTheme = 'dark' | 'light';

export const THEME_STORAGE_KEY = 'sos_theme';

function normalize(preference: unknown): ThemePreference {
  return preference === 'light' || preference === 'dark' || preference === 'system'
    ? preference
    : 'system';
}

/**
 * Resolves a stored preference against the OS setting.
 * Defaults to dark, which is what the chrome was designed around.
 */
export function resolveTheme(
  preference: unknown,
  prefersDark: boolean
): ResolvedTheme {
  const normalized = normalize(preference);
  if (normalized === 'system') return prefersDark ? 'dark' : 'light';
  return normalized;
}

export function readStoredTheme(): ThemePreference {
  if (typeof localStorage === 'undefined') return 'system';
  try {
    const raw = localStorage.getItem(THEME_STORAGE_KEY);
    if (raw) return normalize(raw);
  } catch {
    /* storage disabled — fall through to the default */
  }
  return 'system';
}

function systemPrefersDark(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return true;
  }
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

/**
 * Applies `preference` to the document and keeps it in sync with the OS while
 * the preference is 'system'. Returns a teardown function.
 */
export function applyTheme(preference: ThemePreference): () => void {
  const normalized = normalize(preference);

  if (typeof document !== 'undefined') {
    document.documentElement.dataset.theme = resolveTheme(
      normalized,
      systemPrefersDark()
    );
    // Lets the UA style form controls, scrollbars, and the window chrome to match.
    document.documentElement.style.colorScheme = resolveTheme(
      normalized,
      systemPrefersDark()
    );
  }

  if (typeof localStorage !== 'undefined') {
    try {
      localStorage.setItem(THEME_STORAGE_KEY, normalized);
    } catch {
      /* non-fatal: the in-memory document attribute is already correct */
    }
  }

  if (
    normalized !== 'system' ||
    typeof window === 'undefined' ||
    typeof window.matchMedia !== 'function'
  ) {
    return () => {};
  }

  const query = window.matchMedia('(prefers-color-scheme: dark)');
  const onChange = () => {
    const resolved = resolveTheme('system', query.matches);
    document.documentElement.dataset.theme = resolved;
    document.documentElement.style.colorScheme = resolved;
  };
  query.addEventListener('change', onChange);
  return () => query.removeEventListener('change', onChange);
}
