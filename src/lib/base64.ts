/**
 * Base64 → bytes, in plain JavaScript.
 *
 * React Native's `Blob` is only a handle into the native blob store. Handing one
 * to `supabase.storage.upload()` produced a request with an empty body and
 * Storage answered HTTP 400, so every image upload silently failed. The image
 * manipulator can hand us base64 directly, which leaves only the decoding —
 * `atob` does not exist in Hermes and pulling in a native module for this would
 * be out of proportion.
 */

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
const INVALID = 255;
const PAD = '='.charCodeAt(0);

const LOOKUP = (() => {
  const table = new Uint8Array(256).fill(INVALID);
  for (let i = 0; i < ALPHABET.length; i += 1) {
    table[ALPHABET.charCodeAt(i)] = i;
  }
  // URL-safe aliases, so a payload from any source decodes the same.
  table['-'.charCodeAt(0)] = 62;
  table['_'.charCodeAt(0)] = 63;
  return table;
})();

function isSkippable(code: number): boolean {
  // Whitespace: encoders wrap long payloads at 64 or 76 characters.
  return code === 0x20 || code === 0x09 || code === 0x0a || code === 0x0d;
}

/** Drops a `data:<mime>;base64,` prefix if the caller passed a full data URI. */
function payloadOf(input: string): string {
  if (!input.startsWith('data:')) {
    return input;
  }
  const comma = input.indexOf(',');
  return comma === -1 ? '' : input.slice(comma + 1);
}

export function base64ToBytes(input: string): Uint8Array {
  const base64 = payloadOf(input);

  // Count first so the output is allocated exactly once — these are images.
  let symbols = 0;
  for (let i = 0; i < base64.length; i += 1) {
    const code = base64.charCodeAt(i);
    if (code === PAD || isSkippable(code)) {
      continue;
    }
    if (LOOKUP[code] === INVALID) {
      throw new Error('base64_invalid_character');
    }
    symbols += 1;
  }

  // 4 symbols carry 3 bytes; 2 carry 1 and 3 carry 2. A lone trailing symbol
  // would be 6 dangling bits and cannot come from a valid encoder.
  if (symbols % 4 === 1) {
    throw new Error('base64_invalid_length');
  }

  const bytes = new Uint8Array((symbols * 3) >> 2);
  let byteIndex = 0;
  let buffer = 0;
  let bits = 0;

  for (let i = 0; i < base64.length; i += 1) {
    const code = base64.charCodeAt(i);
    if (code === PAD || isSkippable(code)) {
      continue;
    }
    buffer = (buffer << 6) | LOOKUP[code]!;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      bytes[byteIndex] = (buffer >> bits) & 0xff;
      byteIndex += 1;
    }
  }

  return bytes;
}

export function base64ToArrayBuffer(input: string): ArrayBuffer {
  const bytes = base64ToBytes(input);
  return bytes.buffer as ArrayBuffer;
}
