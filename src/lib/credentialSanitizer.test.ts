import { describe, expect, it } from 'vitest';
import { isSecretField, scrubAccount, toStorableAccount } from './credentialSanitizer';

describe('scrubAccount', () => {
  it('strips every credential field from a linked account', () => {
    const linked = {
      id: 'acc_1',
      email: 'user@example.com',
      provider: 'google_drive',
      accessToken: 'ya29.secret',
      refreshToken: '1//refresh',
      clientSecret: 'GOCSPX-secret',
      apiKey: 'AIza-secret',
      tokenExpiresAt: 1234567890,
    };

    const { account, hadSecret } = scrubAccount(linked);

    expect(hadSecret).toBe(true);
    expect(account.accessToken).toBeUndefined();
    expect(account.refreshToken).toBeUndefined();
    expect(account.clientSecret).toBeUndefined();
    expect(account.apiKey).toBeUndefined();
    expect(account.tokenExpiresAt).toBeUndefined();

    // The real point: nothing resembling a token survives the write path.
    const serialized = JSON.stringify(account);
    expect(serialized).not.toContain('ya29.secret');
    expect(serialized).not.toContain('1//refresh');
    expect(serialized).not.toContain('GOCSPX-secret');
    expect(serialized).not.toContain('AIza-secret');
  });

  it('keeps non-secret profile fields intact', () => {
    const profile = {
      id: 'acc_2',
      email: 'user@example.com',
      name: 'A User',
      avatarColor: '#1a73e8',
      quotaUsedMb: 12,
      quotaTotalMb: 15360,
      serverUrl: 'https://cloud.example.com',
    };

    const { account, hadSecret } = scrubAccount(profile);

    expect(hadSecret).toBe(false);
    expect(account).toEqual(profile);
  });

  it('records hasCredentials so the UI can still show a connected state', () => {
    const { account } = scrubAccount<Record<string, unknown>>({
      id: 'acc_3',
      accessToken: 'secret',
    });
    expect(account.hasCredentials).toBe(true);
  });

  it('does not overwrite an existing hasCredentials flag', () => {
    const { account } = scrubAccount<Record<string, unknown>>({
      id: 'acc_4',
      hasCredentials: false,
      apiKey: 'k',
    });
    expect(account.hasCredentials).toBe(true);
  });

  it('leaves hasCredentials false when nothing was stripped', () => {
    const { account, hadSecret } = scrubAccount<Record<string, unknown>>({
      id: 'acc_5',
      hasCredentials: false,
    });
    expect(hadSecret).toBe(false);
    expect(account.hasCredentials).toBe(false);
  });

  it('does not mutate the input object', () => {
    const original = { id: 'acc_6', accessToken: 'secret' };
    toStorableAccount(original);
    expect(original.accessToken).toBe('secret');
  });

  it('drops an empty-string credential too', () => {
    const { hadSecret } = scrubAccount({ id: 'acc_7', accessToken: '' });
    expect(hadSecret).toBe(true);
  });

  it('recognises every credential field name', () => {
    for (const field of [
      'accessToken',
      'refreshToken',
      'clientSecret',
      'apiKey',
      'tokenExpiresAt',
      'password',
    ]) {
      expect(isSecretField(field)).toBe(true);
    }
    expect(isSecretField('email')).toBe(false);
    expect(isSecretField('name')).toBe(false);
  });
});
