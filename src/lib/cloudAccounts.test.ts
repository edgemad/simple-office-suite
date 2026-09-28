import { beforeEach, describe, expect, it } from 'vitest';
import { get } from 'svelte/store';
import { cloudAccounts, updateCloudAccount, forgetCloudAccount } from './googleSync';
import type { CloudStorageAccount } from '../types';

const base: CloudStorageAccount = {
  id: 'microsoft',
  provider: 'onedrive',
  providerName: 'OneDrive',
  email: '',
  name: 'OneDrive',
  avatarColor: '#0078D4',
  isSignedIn: true,
  quotaUsedMb: 0,
  quotaTotalMb: 0,
  hasCredentials: true,
};

describe('cloud account records', () => {
  beforeEach(() => {
    cloudAccounts.set([base]);
  });

  it('records the selected library so a restart shows the same drive', () => {
    updateCloudAccount('microsoft', { driveId: 'drive-9', driveType: 'sharepoint' });
    const account = get(cloudAccounts)[0];
    expect(account.driveId).toBe('drive-9');
    expect(account.driveType).toBe('sharepoint');
  });

  it('leaves other accounts untouched', () => {
    cloudAccounts.set([base, { ...base, id: 'google', provider: 'google_drive' }]);
    updateCloudAccount('google', { driveId: 'gd-1' });
    expect(get(cloudAccounts).find((a) => a.id === 'microsoft')?.driveId).toBeUndefined();
    expect(get(cloudAccounts).find((a) => a.id === 'google')?.driveId).toBe('gd-1');
  });

  it('ignores an unknown account rather than failing', () => {
    updateCloudAccount('nope', { driveId: 'x' });
    expect(get(cloudAccounts)).toHaveLength(1);
  });

  it('drops the record on disconnect so no stale account is restored', () => {
    forgetCloudAccount('microsoft');
    expect(get(cloudAccounts)).toHaveLength(0);
  });
});
