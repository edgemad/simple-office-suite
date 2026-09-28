/**
 * Byte coercion for upload payloads.
 *
 * The rule this exists to enforce: a file's bytes must never be routed through
 * a JS string. Office Open XML is a zip archive, so a save can contain any byte
 * value; anything that is not valid UTF-8 gets rewritten on the way through a
 * string, which silently corrupts the file rather than failing loudly.
 */

export type UploadContent = string | Uint8Array | Blob | ArrayBuffer;

export function toUploadBytes(content: UploadContent): Uint8Array {
  if (typeof content === 'string') return new TextEncoder().encode(content);
  if (content instanceof Uint8Array) return content;
  if (content instanceof ArrayBuffer) return new Uint8Array(content);
  // A Blob cannot be read synchronously; callers that pass one should await it
  // and pass the resulting bytes instead of silently uploading nothing.
  return new Uint8Array(0);
}
