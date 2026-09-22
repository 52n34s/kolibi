/**
 * RFC-4122 v4 UUIDs without a native dependency.
 *
 * Hermes ships no `globalThis.crypto`, so `crypto.randomUUID()` throws on
 * device while passing every Node test. Adding `expo-crypto` or
 * `react-native-get-random-values` would pull in native code and break OTA
 * updates, so the randomness comes from `crypto.getRandomValues` when a
 * runtime happens to provide it and from `Math.random` otherwise.
 *
 * This module is the ONLY place in `src/` allowed to touch `globalThis.crypto`
 * — `id.test.ts` scans the tree and fails on any other occurrence.
 */

const HEX = '0123456789abcdef';

/** Byte source; falls back to Math.random when Web Crypto is unavailable. */
function randomBytes(count: number): Uint8Array {
  const bytes = new Uint8Array(count);

  try {
    const webCrypto = globalThis.crypto;
    if (webCrypto && typeof webCrypto.getRandomValues === 'function') {
      webCrypto.getRandomValues(bytes);
      return bytes;
    }
  } catch {
    // A runtime may expose `crypto` as a throwing getter — fall through.
  }

  for (let index = 0; index < count; index += 1) {
    bytes[index] = Math.floor(Math.random() * 256);
  }
  return bytes;
}

function toHex(byte: number): string {
  return `${HEX[(byte >> 4) & 0x0f]}${HEX[byte & 0x0f]}`;
}

/**
 * A lowercase RFC-4122 version-4 UUID:
 * `xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx` with `y` in `[89ab]`.
 */
export function newId(): string {
  const bytes = randomBytes(16);

  // Version 4 in the high nibble of byte 6, variant 10xx in byte 8.
  bytes[6] = ((bytes[6] ?? 0) & 0x0f) | 0x40;
  bytes[8] = ((bytes[8] ?? 0) & 0x3f) | 0x80;

  let out = '';
  for (let index = 0; index < 16; index += 1) {
    if (index === 4 || index === 6 || index === 8 || index === 10) {
      out += '-';
    }
    out += toHex(bytes[index] ?? 0);
  }
  return out;
}
