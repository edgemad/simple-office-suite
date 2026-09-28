/**
 * Google OAuth 2.0 for a desktop app: authorization code + PKCE, loopback redirect.
 *
 * Why this shape:
 * - PKCE means there is no client secret in the app at all. A desktop binary
 *   cannot keep a secret anyway — anything shipped can be read out of it.
 * - The loopback redirect (http://127.0.0.1:<port>) is the flow Google
 *   documents for "Desktop app" clients, so it needs no custom URL scheme
 *   registered in the Cloud console. The user clicks Connect, picks an
 *   account, and is done.
 * - The OOB/"urn:ietf:wg:oauth:2.0:oob" flow this replaced is deprecated by
 *   Google and no longer works for new clients.
 *
 * The pure parts (challenge generation, URL building, response parsing) are
 * separated from the network calls so they can be tested without a browser.
 */

import type { CloudCredentials } from '../types';

/** The scopes SOS actually needs. Deliberately not `drive` full access. */
export const GOOGLE_SCOPES = [
  'https://www.googleapis.com/auth/drive.file',
  'https://www.googleapis.com/auth/userinfo.email',
  'https://www.googleapis.com/auth/userinfo.profile',
] as const;

export const OAUTH_TOKEN_URL = 'https://oauth2.googleapis.com/token';
export const OAUTH_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
export const OAUTH_SCOPE_STRING = GOOGLE_SCOPES.join(' ');

/** Google's error responses are inconsistent; this is the shape we rely on. */
export interface OAuthTokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
  scope?: string;
  token_type?: string;
  id_token?: string;
  error?: string;
  error_description?: string;
}

function base64UrlEncode(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function randomString(byteLength: number): string {
  const bytes = new Uint8Array(byteLength);
  crypto.getRandomValues(bytes);
  return base64UrlEncode(bytes);
}

/**
 * Verifier/challenge pair for PKCE (S256).
 *
 * The verifier is 32 random bytes (43 base64url chars), inside the 43-128
 * range Google requires. The challenge is its SHA-256 digest, also base64url.
 */
export async function createPkcePair(): Promise<{ verifier: string; challenge: string }> {
  const verifier = randomString(32);
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier));
  return { verifier, challenge: base64UrlEncode(new Uint8Array(digest)) };
}

export interface AuthUrlOptions {
  clientId: string;
  challenge: string;
  redirectUri: string;
  /** Opaque value echoed back on the callback; used to block CSRF. */
  state: string;
  scopes?: string;
  /** Set true only to request offline access and a refresh token. */
  offline?: boolean;
}

/** Builds the Google consent-screen URL the browser should be sent to. */
export function buildAuthUrl(options: AuthUrlOptions): string {
  const params = new URLSearchParams({
    client_id: options.clientId.trim(),
    redirect_uri: options.redirectUri,
    response_type: 'code',
    scope: options.scopes ?? OAUTH_SCOPE_STRING,
    state: options.state,
    code_challenge: options.challenge,
    code_challenge_method: 'S256',
    access_type: options.offline ? 'offline' : 'online',
    // A consent screen that re-prompts is confusing when the user thinks they
    // already connected; keeping it quiet makes reconnects uneventful.
    prompt: options.offline ? 'consent' : 'none',
  });
  return `${OAUTH_AUTH_URL}?${params.toString()}`;
}

/** Pulls the authorization code out of a loopback callback URL. */
export function parseCallbackUrl(
  callbackUrl: string
): { code: string; state: string } | { error: string; errorDescription?: string } {
  let url: URL;
  try {
    url = new URL(callbackUrl);
  } catch {
    return { error: 'The redirect URL was not a valid URL' };
  }

  const error = url.searchParams.get('error');
  if (error) {
    return {
      error,
      errorDescription: url.searchParams.get('error_description') ?? undefined,
    };
  }

  const code = url.searchParams.get('code');
  if (!code) return { error: 'The redirect did not include an authorization code' };

  return { code, state: url.searchParams.get('state') ?? '' };
}

interface TokenRequestOptions {
  code: string;
  clientId: string;
  redirectUri: string;
  verifier: string;
  clientSecret?: string;
}

/** Exchanges the authorization code for tokens. PKCE verifier is mandatory. */
export async function requestTokenFromCode(
  options: TokenRequestOptions
): Promise<CloudCredentials> {
  const body = new URLSearchParams({
    code: options.code,
    client_id: options.clientId.trim(),
    redirect_uri: options.redirectUri,
    grant_type: 'authorization_code',
    code_verifier: options.verifier,
  });
  if (options.clientSecret?.trim()) {
    body.set('client_secret', options.clientSecret.trim());
  }

  const json = await postTokenRequest(body);
  return toCredentials(json);
}

/** Refreshes an expired access token using the stored refresh token. */
export async function refreshAccessToken(
  clientId: string,
  refreshToken: string,
  clientSecret?: string
): Promise<CloudCredentials> {
  const body = new URLSearchParams({
    client_id: clientId.trim(),
    refresh_token: refreshToken,
    grant_type: 'refresh_token',
  });
  if (clientSecret?.trim()) {
    body.set('client_secret', clientSecret.trim());
  }

  const json = await postTokenRequest(body);
  return toCredentials(json);
}

async function postTokenRequest(body: URLSearchParams): Promise<OAuthTokenResponse> {
  const response = await fetch(OAUTH_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });

  const text = await response.text();
  let json: OAuthTokenResponse;
  try {
    json = JSON.parse(text) as OAuthTokenResponse;
  } catch {
    throw new Error(`Google returned an unreadable token response (${response.status}).`);
  }

  if (!response.ok || json.error) {
    const detail = json.error_description ?? json.error ?? text.slice(0, 300);
    throw new Error(describeOAuthError(json.error, detail));
  }
  return json;
}

function toCredentials(json: OAuthTokenResponse): CloudCredentials {
  if (!json.access_token) {
    throw new Error('Google did not return an access token.');
  }
  return {
    accessToken: json.access_token,
    refreshToken: json.refresh_token,
    tokenExpiresAt: Date.now() + (json.expires_in ?? 3600) * 1000,
  };
}

/** Turns Google's terse error codes into something a person can act on. */
export function describeOAuthError(code: string | undefined, detail: string): string {
  switch (code) {
    case 'invalid_client':
      return (
        'Google rejected the client ID. Check that the OAuth client ID in Settings ' +
        'is correct, and that the app is registered as a Desktop app. ' +
        `Details: ${detail}`
      );
    case 'invalid_grant':
      return 'The authorization code was rejected. Please try connecting again.';
    case 'access_denied':
      return 'Access was declined. SOS only requests access to files it creates or that you open.';
    case 'unauthorized_client':
      return 'This client ID is not allowed to use the authorization code flow.';
    default:
      return `Google sign-in failed: ${detail}`;
  }
}

/** True when the client ID looks like a real Google OAuth client ID. */
export function isPlausibleClientId(clientId: string): boolean {
  return /^[0-9]+-[a-z0-9]{20,}\.apps\.googleusercontent\.com$/i.test(clientId.trim());
}
