import type { AppSettings } from '../types';

export const DEFAULT_SETTINGS: AppSettings = {
  theme: 'dark',
  defaultMode: 'writer',
  autoSaveIntervalMin: 5,
  language: 'en-US',
  showRuler: true,
  showStatusBar: true,
  wordDefaultFont: 'Inter, sans-serif',
  wordDefaultFontSize: 11,
  wordDefaultPageSize: 'a4',
  wordSpellCheck: true,
  sheetShowGridlines: true,
  sheetCalculationMode: 'auto',
  sheetShowFormulaBar: true,
  slideDefaultRatio: '16:9',
  slideDefaultTheme: 'dark',
  pdfDefaultZoom: '100%',
  pdfHighlightFields: true,
  aiProvider: 'local',
  aiApiKey: '',
  aiModel: 'gpt-4o',
  aiTemperature: 0.7,
  emailSignature: '--\nSent from Simple Office Suite (local demo app)',
  emailCheckIntervalMin: 5,
};

const STORAGE_KEY = 'simple_office_settings_v1';

export function loadSettings(): AppSettings {
  if (typeof window === 'undefined' || !window.localStorage) {
    return { ...DEFAULT_SETTINGS };
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_SETTINGS };
    const parsed = JSON.parse(raw);
    return { ...DEFAULT_SETTINGS, ...parsed };
  } catch (err) {
    console.warn('Failed to parse settings from storage:', err);
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveSettings(settings: AppSettings): void {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch (err) {
    console.error('Failed to save settings:', err);
  }
}
