import { describe, expect, it } from 'vitest';
import { isGoogleNative } from './googleWorkspace';
import { GOOGLE_MIME } from './googleWorkspace';

describe('isGoogleNative', () => {
  it('recognises the native Google document types', () => {
    expect(isGoogleNative(GOOGLE_MIME.document)).toBe(true);
    expect(isGoogleNative(GOOGLE_MIME.spreadsheet)).toBe(true);
    expect(isGoogleNative(GOOGLE_MIME.presentation)).toBe(true);
    expect(isGoogleNative(GOOGLE_MIME.form)).toBe(true);
  });

  it('does not treat Office files as native', () => {
    // A docx is a real file the Drive API can write to, unlike a native Doc.
    expect(
      isGoogleNative(
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      )
    ).toBe(false);
    expect(isGoogleNative('text/csv')).toBe(false);
  });

  it('does not treat a shortcut as a document', () => {
    // A shortcut is a pointer, so writing to it is not the same operation.
    expect(isGoogleNative(GOOGLE_MIME.shortcut)).toBe(false);
  });

  it('handles an empty mime type', () => {
    expect(isGoogleNative('')).toBe(false);
  });
});
