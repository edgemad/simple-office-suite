import { describe, expect, it } from 'vitest';
import {
  MICROSOFT_SCOPE_STRING,
  MICROSOFT_SCOPES,
  GRAPH_BASE,
  isPlausibleMicrosoftClientId,
  workspaceForItem,
  type GraphDriveItem,
} from './microsoftGraph';

describe('isPlausibleMicrosoftClientId', () => {
  it('accepts a UUID', () => {
    expect(
      isPlausibleMicrosoftClientId('12345678-1234-1234-1234-123456789abc')
    ).toBe(true);
    expect(
      isPlausibleMicrosoftClientId('12345678-1234-1234-1234-123456789ABC')
    ).toBe(true);
  });

  it('trims surrounding whitespace', () => {
    expect(
      isPlausibleMicrosoftClientId('  12345678-1234-1234-1234-123456789abc  ')
    ).toBe(true);
  });

  it('rejects a Google client ID', () => {
    expect(
      isPlausibleMicrosoftClientId(
        '123456789012-abcdefghijklmnopqrstuvwxyz012345.apps.googleusercontent.com'
      )
    ).toBe(false);
  });

  it('rejects malformed input', () => {
    expect(isPlausibleMicrosoftClientId('')).toBe(false);
    expect(isPlausibleMicrosoftClientId('not-a-uuid')).toBe(false);
    expect(isPlausibleMicrosoftClientId('12345678-1234-1234-1234-123456789ab')).toBe(false);
  });
});

describe('scopes', () => {
  it('requests offline access so a refresh token is issued', () => {
    expect(MICROSOFT_SCOPES).toContain('offline_access');
  });

  it('does not ask for tenant-wide site control', () => {
    // Sites.FullControl.All or Sites.ReadWrite.All would grant far more than
    // reading and writing documents.
    expect(MICROSOFT_SCOPE_STRING).not.toContain('Sites.');
    expect(MICROSOFT_SCOPE_STRING).toContain('Files.ReadWrite');
  });
});

describe('workspaceForItem', () => {
  const item = (name: string, isFolder = false): GraphDriveItem => ({
    id: '1',
    name,
    size: 0,
    folder: isFolder ? { childCount: 0 } : undefined,
  });

  it('routes Word formats to writer', () => {
    expect(workspaceForItem(item('a.docx')).workspace).toBe('writer');
    expect(workspaceForItem(item('a.doc')).workspace).toBe('writer');
    expect(workspaceForItem(item('a.rtf')).workspace).toBe('writer');
    expect(workspaceForItem(item('a.odt')).workspace).toBe('writer');
  });

  it('routes spreadsheet formats to sheets', () => {
    expect(workspaceForItem(item('a.xlsx')).workspace).toBe('sheets');
    expect(workspaceForItem(item('a.xls')).workspace).toBe('sheets');
    expect(workspaceForItem(item('a.csv')).workspace).toBe('sheets');
  });

  it('routes presentation formats to slides', () => {
    expect(workspaceForItem(item('a.pptx')).workspace).toBe('slides');
    expect(workspaceForItem(item('a.ppt')).workspace).toBe('slides');
  });

  it('is case insensitive on the extension', () => {
    expect(workspaceForItem(item('REPORT.DOCX')).workspace).toBe('writer');
  });

  it('returns null for files it cannot open', () => {
    expect(workspaceForItem(item('photo.png')).workspace).toBeNull();
    expect(workspaceForItem(item('archive.zip')).workspace).toBeNull();
  });

  it('labels folders and unknown files', () => {
    expect(workspaceForItem(item('Documents', true)).label).toBe('Folder');
    expect(workspaceForItem(item('photo.png')).label).toBe('File');
  });

  it('handles names with no extension', () => {
    expect(workspaceForItem(item('README')).workspace).toBeNull();
  });
});

describe('graph base', () => {
  it('targets the v1.0 API', () => {
    expect(GRAPH_BASE).toBe('https://graph.microsoft.com/v1.0');
  });
});
