import { describe, expect, it } from 'vitest';
import {
  GOOGLE_MIME,
  OFFICE_MIME,
  buildBrowseQuery,
  describeFile,
  exportMimeFor,
  extensionForMime,
  isOpenableInSos,
  kindForMime,
  officeMimeFor,
  requiresExport,
  uploadMimeFor,
  workspaceForMime,
} from './googleWorkspace';

describe('kindForMime', () => {
  it('recognises every Google-native type', () => {
    expect(kindForMime(GOOGLE_MIME.document)).toBe('document');
    expect(kindForMime(GOOGLE_MIME.spreadsheet)).toBe('spreadsheet');
    expect(kindForMime(GOOGLE_MIME.presentation)).toBe('presentation');
    expect(kindForMime(GOOGLE_MIME.form)).toBe('form');
    expect(kindForMime(GOOGLE_MIME.folder)).toBe('folder');
  });

  it('recognises generic families', () => {
    expect(kindForMime('image/png')).toBe('image');
    expect(kindForMime('video/mp4')).toBe('video');
    expect(kindForMime('audio/mpeg')).toBe('audio');
    expect(kindForMime('application/zip')).toBe('archive');
    expect(kindForMime('text/markdown')).toBe('text');
    expect(kindForMime('application/octet-stream')).toBe('binary');
  });
});

describe('requiresExport', () => {
  it('is true for every Google-native type', () => {
    for (const mime of Object.values(GOOGLE_MIME)) {
      expect(requiresExport(mime)).toBe(true);
    }
  });

  it('is false for Office and plain types', () => {
    expect(requiresExport(OFFICE_MIME.docx)).toBe(false);
    expect(requiresExport('text/plain')).toBe(false);
  });
});

describe('workspaceForMime', () => {
  it('routes Google-native files to the matching workspace', () => {
    expect(workspaceForMime(GOOGLE_MIME.document)).toBe('writer');
    expect(workspaceForMime(GOOGLE_MIME.spreadsheet)).toBe('sheets');
    expect(workspaceForMime(GOOGLE_MIME.presentation)).toBe('slides');
    expect(workspaceForMime(GOOGLE_MIME.form)).toBe('forms');
  });

  it('routes Office files to the matching workspace', () => {
    expect(workspaceForMime(OFFICE_MIME.docx)).toBe('writer');
    expect(workspaceForMime(OFFICE_MIME.xlsx)).toBe('sheets');
    expect(workspaceForMime(OFFICE_MIME.pptx)).toBe('slides');
  });

  it('routes ODF and plain-text files', () => {
    expect(workspaceForMime('application/vnd.oasis.opendocument.text')).toBe('writer');
    expect(workspaceForMime('text/csv')).toBe('sheets');
    expect(workspaceForMime('text/markdown')).toBe('writer');
    expect(workspaceForMime('text/plain')).toBe('writer');
  });

  it('returns null for types with no workspace', () => {
    expect(workspaceForMime('image/png')).toBeNull();
    expect(workspaceForMime('application/zip')).toBeNull();
    expect(workspaceForMime('video/mp4')).toBeNull();
  });
});

describe('isOpenableInSos', () => {
  it('accepts everything with a workspace', () => {
    for (const mime of [
      GOOGLE_MIME.document,
      GOOGLE_MIME.spreadsheet,
      GOOGLE_MIME.presentation,
      GOOGLE_MIME.form,
      OFFICE_MIME.docx,
      OFFICE_MIME.xlsx,
      OFFICE_MIME.pptx,
      'text/csv',
    ]) {
      expect(isOpenableInSos(mime)).toBe(true);
    }
  });

  it('rejects media and archives', () => {
    expect(isOpenableInSos('image/png')).toBe(false);
    expect(isOpenableInSos('video/mp4')).toBe(false);
    expect(isOpenableInSos('application/zip')).toBe(false);
  });
});

describe('officeMimeFor', () => {
  it('maps each editing workspace to its Office type', () => {
    expect(officeMimeFor('writer')).toBe(OFFICE_MIME.docx);
    expect(officeMimeFor('sheets')).toBe(OFFICE_MIME.xlsx);
    expect(officeMimeFor('slides')).toBe(OFFICE_MIME.pptx);
  });

  it('has no Office equivalent for forms or drive', () => {
    expect(officeMimeFor('forms')).toBeNull();
    expect(officeMimeFor('drive')).toBeNull();
  });
});

describe('exportMimeFor', () => {
  it('asks Drive to render a Google-native file', () => {
    expect(exportMimeFor(GOOGLE_MIME.document, 'writer')).toBe(OFFICE_MIME.docx);
    expect(exportMimeFor(GOOGLE_MIME.spreadsheet, 'sheets')).toBe(OFFICE_MIME.xlsx);
    expect(exportMimeFor(GOOGLE_MIME.presentation, 'slides')).toBe(OFFICE_MIME.pptx);
  });

  it('skips the export when the file is already the target type', () => {
    expect(exportMimeFor(OFFICE_MIME.docx, 'writer')).toBeNull();
    expect(exportMimeFor(OFFICE_MIME.xlsx, 'sheets')).toBeNull();
  });

  it('leaves unrelated files to download as-is', () => {
    expect(exportMimeFor('text/csv', 'sheets')).toBeNull();
    expect(exportMimeFor(OFFICE_MIME.docx, 'sheets')).toBeNull();
  });

  it('has nothing to export for forms', () => {
    expect(exportMimeFor(GOOGLE_MIME.form, 'forms')).toBeNull();
  });
});

describe('uploadMimeFor', () => {
  it('targets the Google-native type when asked', () => {
    expect(uploadMimeFor('writer', true)).toBe(GOOGLE_MIME.document);
    expect(uploadMimeFor('sheets', true)).toBe(GOOGLE_MIME.spreadsheet);
    expect(uploadMimeFor('slides', true)).toBe(GOOGLE_MIME.presentation);
  });

  it('targets Office Open XML otherwise', () => {
    expect(uploadMimeFor('writer', false)).toBe(OFFICE_MIME.docx);
    expect(uploadMimeFor('sheets', false)).toBe(OFFICE_MIME.xlsx);
    expect(uploadMimeFor('slides', false)).toBe(OFFICE_MIME.pptx);
  });
});

describe('extensionForMime', () => {
  it('maps the common document types', () => {
    expect(extensionForMime(OFFICE_MIME.docx)).toBe('docx');
    expect(extensionForMime(OFFICE_MIME.xlsx)).toBe('xlsx');
    expect(extensionForMime(OFFICE_MIME.pptx)).toBe('pptx');
    expect(extensionForMime('text/markdown')).toBe('md');
    expect(extensionForMime('text/plain')).toBe('txt');
  });

  it('falls back to bin', () => {
    expect(extensionForMime('application/x-unknown')).toBe('bin');
  });
});

describe('describeFile', () => {
  it('names the Google-native types', () => {
    expect(describeFile('Q3 plan', GOOGLE_MIME.document)).toBe('Google Doc');
    expect(describeFile('Budget', GOOGLE_MIME.spreadsheet)).toBe('Google Sheet');
    expect(describeFile('Deck', GOOGLE_MIME.presentation)).toBe('Google Slides');
    expect(describeFile('Survey', GOOGLE_MIME.form)).toBe('Google Form');
    expect(describeFile('Archive', GOOGLE_MIME.folder)).toBe('Folder');
  });

  it('names common file types', () => {
    expect(describeFile('a.docx', OFFICE_MIME.docx)).toBe('DOCX');
    expect(describeFile('a.pdf', 'application/pdf')).toBe('PDF');
    expect(describeFile('a.png', 'image/png')).toBe('Image');
    expect(describeFile('notes.md', 'text/markdown')).toBe('Text');
  });

  it('falls back to the name extension for untyped uploads', () => {
    expect(describeFile('Report.docx', 'application/octet-stream')).toBe('DOCX');
    expect(describeFile('Sheet.csv', 'application/octet-stream')).toBe('CSV');
  });

  it('falls back to bin with no usable name', () => {
    expect(describeFile('mystery', 'application/x-unknown')).toBe('BIN');
  });
});

describe('buildBrowseQuery', () => {
  it('scopes to the root when no folder is given', () => {
    const query = buildBrowseQuery();
    expect(query).toContain("'root' in parents");
    expect(query).toContain('trashed = false');
  });

  it('scopes to a specific folder when one is given', () => {
    expect(buildBrowseQuery('abc123')).toContain("'abc123' in parents");
    expect(buildBrowseQuery('abc123')).not.toContain("'root' in parents");
  });

  it('includes folders, or the user could never descend into one', () => {
    expect(buildBrowseQuery()).not.toContain(`mimeType != '${GOOGLE_MIME.folder}'`);
  });

  it('excludes shortcuts, which point at files listed anyway', () => {
    expect(buildBrowseQuery()).toContain(`mimeType != '${GOOGLE_MIME.shortcut}'`);
  });

  it('hides trashed files', () => {
    expect(buildBrowseQuery()).toContain('trashed = false');
  });
});
