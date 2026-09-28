import { describe, expect, it } from 'vitest';
import { toUploadBytes } from './uploadBytes';

describe('multipart upload payloads', () => {
  /**
   * Office Open XML is a zip archive, so a save can contain any byte value.
   * If the payload ever passes through a JS string, bytes above 0x7F are
   * rewritten and the saved file is silently corrupt.
   */
  it('round-trips every byte value, including invalid UTF-8', () => {
    const bytes = new Uint8Array(256);
    for (let i = 0; i < 256; i++) bytes[i] = i;

    const copied = toUploadBytes(bytes);
    expect(copied.length).toBe(256);
    for (let i = 0; i < 256; i++) {
      expect(copied[i]).toBe(i);
    }
  });

  it('preserves a real zip signature and the invalid bytes that follow it', () => {
    // "PK\x03\x04" then bytes that are not valid UTF-8, as in a real docx.
    const zip = new Uint8Array([0x50, 0x4b, 0x03, 0x04, 0xff, 0xfe, 0x80, 0x81]);
    const copied = toUploadBytes(zip);
    expect(Array.from(copied)).toEqual([0x50, 0x4b, 0x03, 0x04, 0xff, 0xfe, 0x80, 0x81]);
  });

  it('encodes text payloads as UTF-8', () => {
    const encoded = toUploadBytes('héllo');
    expect(encoded.length).toBeGreaterThan(5);
    expect(new TextDecoder().decode(encoded)).toBe('héllo');
  });

  it('accepts an ArrayBuffer without an extra copy of the wrong length', () => {
    const buffer = new Uint8Array([1, 2, 3, 4]).buffer;
    expect(Array.from(toUploadBytes(buffer))).toEqual([1, 2, 3, 4]);
  });

  it('handles an empty payload', () => {
    expect(toUploadBytes('').length).toBe(0);
  });
});
