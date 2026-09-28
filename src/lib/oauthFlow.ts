/**
 * One sign-in flow, two providers.
 *
 * Google and Microsoft differ only in endpoints, scopes, and how a client ID
 * is validated. The sequence is identical, so it lives here once:
 *
 *   1. bind a loopback port (Rust)
 *   2. generate a PKCE verifier + CSRF state value
 *   3. open the browser at the provider's consent screen
 *   4. wait for the loopback redirect
 *   5. exchange the code for tokens
 *   6. drop the verifier - it is single-use and must not be kept
 *
 * The steps that can be tested without a browser (URL building, callback
 * parsing, error mapping) are the pure ones in googleAuth.ts; this module is
 * the orchestration that has to touch the network.
 */

import {
  buildAuthUrl,
  createPkcePair,
  parseCallbackUrl,
  type OAuthTokenResponse,
} from './googleAuth';
import {
  MICROSOFT_AUTHORIZE_URL,
  MICROSOFT_SCOPE_STRING,
  MICROSOFT_TOKEN_URL,
  isPlausibleMicrosoftClientId,
} from './microsoftGraph';
import type { CloudCredentials } from '../types';
import { isTauri } from './tauri';

export type CloudProvider = 'google' | 'microsoft';

export interface ProviderConfig {
  id: CloudProvider;
  label: string;
  authorizeUrl: string;
  tokenUrl: string;
  scope: string;
  /** Whether to ask for a refresh token. */
  offline: boolean;
  validateClientId(clientId: string): boolean;
  clientIdHint: string;
}

export const PROVIDERS: Record<CloudProvider, ProviderConfig> = {
  google: {
    id: 'google',
    label: 'Google Drive',
    authorizeUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
    tokenUrl: 'https://oauth2.googleapis.com/token',
    scope: 'https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/userinfo.email https://www.googleapis.com/auth/userinfo.profile',
    offline: true,
    validateClientId: (clientId) => /^[0-9]+-[a-z0-9]{20,}\.apps\.googleusercontent\.com$/i.test(clientId.trim()),
    clientIdHint: '123456789012-abcdefghijklmnopqrstuvwxyz012345.apps.googleusercontent.com',
  },
  microsoft: {
    id: 'microsoft',
    label: 'OneDrive / SharePoint',
    authorizeUrl: MICROSOFT_AUTHORIZE_URL,
    tokenUrl: MICROSOFT_TOKEN_URL,
    scope: MICROSOFT_SCOPE_STRING,
    offline: true,
    validateClientId: isPlausibleMicrosoftClientId,
    clientIdHint: '12345678-1234-1234-1234-123456789abc',
  },
};

export class MissingClientIdError extends Error {
  constructor(public provider: CloudProvider) {
    super('no client id');
    this.name = 'MissingClientIdError';
  }
}

export class SignInCancelledError extends Error {
  constructor() {
    super('cancelled');
    this.name = 'SignInCancelledError';
  }
}

export interface SignInOptions {
  provider: CloudProvider;
  clientId: string;
  /** Injectable for tests. */
  now?: () => number;
}

async function invoke<T>(command: string, args: Record<string, unknown> = {}): Promise<T> {
  const { invoke: run } = await import('@tauri-apps/api/core');
  return run<T>(command, args);
}

/** Exchanges a code with the provider's token endpoint. */
async function exchange(
  provider: ProviderConfig,
  body: URLSearchParams
): Promise<OAuthTokenResponse> {
  const response = await fetch(provider.tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });
  const text = await response.text();
  let json: OAuthTokenResponse;
  try {
    json = JSON.parse(text) as OAuthTokenResponse;
  } catch {
    throw new Error(`${provider.label} returned an unreadable token response.`);
  }
  if (!response.ok || json.error) {
    throw new Error(
      `${provider.label} rejected the sign-in: ${
        json.error_description ?? json.error ?? text.slice(0, 200)
      }`
    );
  }
  return json;
}

/**
 * Runs the whole flow and resolves with credentials.
 *
 * The verifier deliberately goes out of scope once the exchange completes: it
 * is single-use, and keeping it would leave a replayable credential behind.
 */
export async function signIn(options: SignInOptions): Promise<CloudCredentials> {
  const provider = PROVIDERS[options.provider];
  const clientId = options.clientId.trim();

  if (!clientId) throw new MissingClientIdError(options.provider);
  if (!provider.validateClientId(clientId)) throw new MissingClientIdError(options.provider);
  if (!isTauri()) {
    throw new Error('Cloud sign-in needs the desktop app; the browser build has no secret store.');
  }

  const port = await invoke<number>('start_oauth_listener');
  const redirectUri = `http://127.0.0.1:${port}/oauth2callback`;

  let verifier: string | undefined;
  try {
    const pkce = await createPkcePair();
    verifier = pkce.verifier;
    const state = pkce.challenge;

    const url = buildAuthUrl({
      clientId,
      challenge: pkce.challenge,
      redirectUri,
      state,
      scopes: provider.scope,
      offline: provider.offline,
    });
    // The auth URL comes from our own config, but the opener plugin is still
    // the right way to launch a system browser on a desktop app.
    const { openUrl } = await import('@tauri-apps/plugin-opener');
    await openUrl(url);

    const callbackUrl = await waitForCallback();

    const parsed = parseCallbackUrl(callbackUrl);
    if ('error' in parsed) {
      if (parsed.error === 'access_denied') throw new SignInCancelledError();
      throw new Error(parsed.errorDescription ?? parsed.error);
    }
    // The state we sent must come back unchanged, or the redirect did not
    // originate from the consent flow we started.
    if (parsed.state !== state) {
      throw new Error('The sign-in response did not match this request. Please try again.');
    }

    const body = new URLSearchParams({
      code: parsed.code,
      client_id: clientId,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
      code_verifier: verifier,
    });
    const json = await exchange(provider, body);
    if (!json.access_token) throw new Error(`${provider.label} did not return an access token.`);

    return {
      accessToken: json.access_token,
      refreshToken: json.refresh_token,
      tokenExpiresAt: (options.now ?? Date.now)() + (json.expires_in ?? 3600) * 1000,
    };
  } finally {
    verifier = undefined;
    await invoke('cancel_oauth_listener').catch(() => {});
  }
}

/**
 * Trades a refresh token for a new access token.
 *
 * Both providers treat a Desktop app as a public client, so the client ID
 * alone is enough - no secret is sent. Google's refresh response omits a new
 * refresh token, so the existing one is carried forward.
 */
export async function refreshCredentials(
  providerKey: CloudProvider,
  credentials: CloudCredentials,
  clientId: string,
  now: () => number = Date.now
): Promise<CloudCredentials> {
  const provider = PROVIDERS[providerKey];
  const refreshToken = credentials.refreshToken?.trim();
  if (!refreshToken) return credentials;

  const response = await fetch(provider.tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: clientId.trim(),
      grant_type: 'refresh_token',
      scope: provider.scope,
    }).toString(),
  });

  if (!response.ok) {
    // A dead refresh token means the user must grant access again.
    throw new Error(
      `${provider.label} needs you to sign in again. ` +
        `Disconnect and reconnect to restore access.`
    );
  }

  const json = (await response.json()) as OAuthTokenResponse;
  if (!json.access_token) throw new Error(`${provider.label} did not return an access token.`);

  return {
    ...credentials,
    accessToken: json.access_token,
    refreshToken: json.refresh_token ?? refreshToken,
    tokenExpiresAt: now() + (json.expires_in ?? 3600) * 1000,
  };
}

/** Polls the Rust listener until the browser redirect lands. */
async function waitForCallback(timeoutMs = 5 * 60 * 1000): Promise<string> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const callback = await invoke<string | null>('take_oauth_callback');
    if (callback) return callback;
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error('Sign-in timed out. The browser window may still be open.');
}
