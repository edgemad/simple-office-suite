import { describe, expect, it } from 'vitest';
import { formatBytes, sortEntries, type CloudEntry } from './cloudFiles';
import { PROVIDERS } from './oauthFlow';

const entry = (name: string, isFolder = false): CloudEntry => ({
  id: name,
  name,
  size: 0,
  isFolder,
  workspace: null,
});

describe('sortEntries', () => {
  it('puts folders before files', () => {
    const sorted = sortEntries([entry('alpha.docx'), entry('zeta', true), entry('beta.xlsx')]);
    expect(sorted.map((item) => item.name)).toEqual(['zeta', 'alpha.docx', 'beta.xlsx']);
  });

  it('sorts naturally so file10 follows file9', () => {
    const sorted = sortEntries([entry('file10.docx'), entry('file9.docx'), entry('file1.docx')]);
    expect(sorted.map((item) => item.name)).toEqual(['file1.docx', 'file9.docx', 'file10.docx']);
  });

  it('ignores case differences', () => {
    const sorted = sortEntries([entry('banana.docx'), entry('Apple.docx')]);
    expect(sorted.map((item) => item.name)).toEqual(['Apple.docx', 'banana.docx']);
  });

  it('does not mutate the input', () => {
    const input = [entry('b.docx'), entry('a', true)];
    sortEntries(input);
    expect(input.map((item) => item.name)).toEqual(['b.docx', 'a']);
  });
});

describe('formatBytes', () => {
  it('formats across units', () => {
    expect(formatBytes(0)).toBe('');
    expect(formatBytes(512)).toBe('512 B');
    expect(formatBytes(2048)).toBe('2.0 KB');
    expect(formatBytes(5 * 1024 * 1024)).toBe('5.0 MB');
    expect(formatBytes(3 * 1024 ** 3)).toBe('3.0 GB');
  });

  it('drops the decimal once the number is large', () => {
    expect(formatBytes(15 * 1024)).toBe('15 KB');
  });

  it('returns nothing for unusable input', () => {
    expect(formatBytes(-1)).toBe('');
    expect(formatBytes(Number.NaN)).toBe('');
  });
});

describe('provider config', () => {
  it('uses the v2 Google endpoints', () => {
    expect(PROVIDERS.google.authorizeUrl).toContain('accounts.google.com/o/oauth2/v2/auth');
    expect(PROVIDERS.google.tokenUrl).toBe('https://oauth2.googleapis.com/token');
  });

  it('targets the common Microsoft tenant so personal and work accounts both work', () => {
    expect(PROVIDERS.microsoft.authorizeUrl).toContain('login.microsoftonline.com/common/');
  });

  it('asks both providers for offline access so sessions survive a restart', () => {
    expect(PROVIDERS.google.offline).toBe(true);
    expect(PROVIDERS.microsoft.offline).toBe(true);
    // Browsing everything needs readonly; drive.file alone would only show
    // files this app created or the user opened through it.
    expect(PROVIDERS.google.scope).toContain('drive.readonly');
    expect(PROVIDERS.google.scope).toContain('drive.file');
    // Full drive (read/write/delete everything) is a much larger grant and
    // should not be requested on first launch.
    expect(PROVIDERS.google.scope).not.toContain('/auth/drive ');
    expect(PROVIDERS.microsoft.scope).toContain('Files.ReadWrite');
  });

  it('never embeds a client secret, because a desktop binary cannot hide one', () => {
    for (const provider of Object.values(PROVIDERS)) {
      expect(Object.keys(provider)).not.toContain('clientSecret');
    }
  });

  it('rejects a client id in the other provider format', () => {
    const uuid = '12345678-1234-1234-1234-123456789abc';
    const googleId = '123456789012-abcdefghijklmnopqrstuvwxyz012345.apps.googleusercontent.com';
    expect(PROVIDERS.microsoft.validateClientId(googleId)).toBe(false);
    expect(PROVIDERS.google.validateClientId(uuid)).toBe(false);
    expect(PROVIDERS.microsoft.validateClientId(uuid)).toBe(true);
    expect(PROVIDERS.google.validateClientId(googleId)).toBe(true);
  });
});
