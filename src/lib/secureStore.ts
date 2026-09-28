/**
 * Secret storage for OAuth tokens and API keys.
 *
 * Tokens used to be written into webview `localStorage` alongside the account
 * record, which meant any script that ran in the page could read them. They now
 * go through the Rust `store_secret` command into a 0600 file in the
 * application data directory, and are cached in memory only for the life of the
 * session.
 *
 * Outside the Tauri shell there is no secret store, so calls resolve to `null`
 * rather than silently falling back to `localStorage`. A browser-hosted dev
 * build therefore cannot sign in, which is the safe failure.
 */

import { isTauri } from './tauri';

const cache = new Map<string, string>();
const MAX_CACHE_ENTRIES = 32;

/** Mirrors the Rust key rules so an invalid key is caught before the IPC hop. */
export function isValidSecretKey(key: string): boolean {
  if (!key || key.length > 128) return false;
  return /^[A-Za-z0-9_-]+$/.test(key);
}

function assertKey(key: string): void {
  if (!isValidSecretKey(key)) {
    throw new Error('Invalid secret key: use letters, digits, hyphen, or underscore only');
  }
}

function remember(key: string, value: string): void {
  if (cache.size >= MAX_CACHE_ENTRIES) {
    const oldest = cache.keys().next();
    if (!oldest.done) cache.delete(oldest.value);
  }
  cache.set(key, value);
}

export async function storeSecret(key: string, value: string): Promise<boolean> {
  assertKey(key);
  if (!isTauri()) return false;
  const { invoke } = await import('@tauri-apps/api/core');
  await invoke('store_secret', { key, value });
  remember(key, value);
  return true;
}

export async function loadSecret(key: string): Promise<string | null> {
  assertKey(key);
  const cached = cache.get(key);
  if (cached !== undefined) return cached;
  if (!isTauri()) return null;
  const { invoke } = await import('@tauri-apps/api/core');
  const value = await invoke<string | null>('load_secret', { key });
  if (typeof value === 'string') remember(key, value);
  return typeof value === 'string' ? value : null;
}

export async function deleteSecret(key: string): Promise<boolean> {
  assertKey(key);
  cache.delete(key);
  if (!isTauri()) return false;
  const { invoke } = await import('@tauri-apps/api/core');
  return invoke<boolean>('delete_secret', { key });
}

/** Drops a cached secret without touching disk, for sign-out. */
export function forgetCachedSecret(key: string): void {
  cache.delete(key);
}

export function secretKeyForAccount(accountId: string): string {
  return `acct_${accountId.replace(/[^A-Za-z0-9_-]/g, '')}`;
}
