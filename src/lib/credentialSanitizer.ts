/**
 * Credential scrubbing for anything persisted into webview storage.
 *
 * Account profiles are mirrored into `localStorage` so the app can render the
 * account list before the secret store is reachable. Tokens, API keys, and
 * client secrets must never be part of that mirror.
 *
 * The types already omit these fields, so this is a second line of defence: a
 * caller that spreads an OAuth response into an account still cannot leak it,
 * because the field is dropped on the way to disk.
 */

const SECRET_FIELDS = [
  'accessToken',
  'refreshToken',
  'clientSecret',
  'apiKey',
  'tokenExpiresAt',
  'password',
] as const;

export type SecretField = (typeof SECRET_FIELDS)[number];

export interface ScrubResult<T> {
  account: T;
  hadSecret: boolean;
}

export function isSecretField(key: string): key is SecretField {
  return (SECRET_FIELDS as readonly string[]).includes(key);
}

/**
 * Returns a copy of `account` with every credential field removed, and
 * `hadSecret` set when something was actually stripped.
 */
export function scrubAccount<T extends Record<string, unknown>>(
  account: T
): ScrubResult<T> {
  const clean: Record<string, unknown> = {};
  let hadSecret = false;

  for (const [key, value] of Object.entries(account)) {
    if (isSecretField(key)) {
      hadSecret = true;
      continue;
    }
    clean[key] = value;
  }

  if (hadSecret) clean.hasCredentials = true;

  return { account: clean as T, hadSecret };
}

/** `scrubAccount` for write paths that only need the cleaned object. */
export function toStorableAccount<T extends Record<string, unknown>>(account: T): T {
  return scrubAccount(account).account;
}
