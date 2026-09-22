import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { base64ToArrayBuffer, base64ToBytes } from './base64.ts';

function bytes(...values: number[]): Uint8Array {
  return new Uint8Array(values);
}

/** Reference encoder, so the fixtures below are not hand-counted bit patterns. */
function encode(input: Uint8Array): string {
  return Buffer.from(input).toString('base64');
}

describe('base64ToBytes', () => {
  it('decodes ASCII round trips', () => {
    assert.deepEqual(base64ToBytes('TWFu'), bytes(77, 97, 110)); // "Man"
    assert.deepEqual(
      Buffer.from(base64ToBytes(encode(Buffer.from('Kolibi', 'utf8')))).toString('utf8'),
      'Kolibi',
    );
  });

  it('handles every padding case', () => {
    // 3 bytes → no padding, 2 bytes → one '=', 1 byte → two '='.
    assert.equal(encode(bytes(1, 2, 3)), 'AQID');
    assert.deepEqual(base64ToBytes('AQID'), bytes(1, 2, 3));

    assert.equal(encode(bytes(1, 2)), 'AQI=');
    assert.deepEqual(base64ToBytes('AQI='), bytes(1, 2));

    assert.equal(encode(bytes(1)), 'AQ==');
    assert.deepEqual(base64ToBytes('AQ=='), bytes(1));
  });

  it('accepts a payload whose padding was stripped', () => {
    assert.deepEqual(base64ToBytes('AQI'), bytes(1, 2));
    assert.deepEqual(base64ToBytes('AQ'), bytes(1));
  });

  it('decodes the empty string to no bytes', () => {
    assert.deepEqual(base64ToBytes(''), bytes());
    assert.deepEqual(base64ToBytes('===='), bytes());
  });

  it('keeps high bytes intact', () => {
    const all = new Uint8Array(256);
    for (let i = 0; i < 256; i += 1) {
      all[i] = i;
    }
    assert.deepEqual(base64ToBytes(encode(all)), all);
  });

  it('survives an image-sized payload', () => {
    const blob = new Uint8Array(8_000);
    for (let i = 0; i < blob.length; i += 1) {
      blob[i] = (i * 31) % 256;
    }
    const decoded = base64ToBytes(encode(blob));
    assert.equal(decoded.length, blob.length);
    assert.deepEqual(decoded, blob);
  });

  it('ignores the line breaks some encoders insert', () => {
    const blob = bytes(9, 8, 7, 6, 5, 4, 3, 2, 1);
    const wrapped = encode(blob).replace(/(.{4})/g, '$1\r\n');
    assert.deepEqual(base64ToBytes(wrapped), blob);
  });

  it('strips a data URI prefix', () => {
    assert.deepEqual(base64ToBytes('data:image/webp;base64,AQID'), bytes(1, 2, 3));
  });

  it('accepts the URL-safe alphabet', () => {
    // 0xFB 0xEF 0xBE encodes as "++++" in standard and "----" URL-safe.
    assert.deepEqual(base64ToBytes('----'), base64ToBytes('++++'));
    assert.deepEqual(base64ToBytes('____'), base64ToBytes('////'));
  });

  it('rejects characters outside the alphabet', () => {
    assert.throws(() => base64ToBytes('AQI*'), /base64_invalid_character/);
  });

  it('rejects a dangling symbol', () => {
    assert.throws(() => base64ToBytes('AQIDA'), /base64_invalid_length/);
  });
});

describe('base64ToArrayBuffer', () => {
  it('returns a buffer sized to the payload, not to the base64 text', () => {
    const buffer = base64ToArrayBuffer('AQI=');
    assert.equal(buffer.byteLength, 2);
    assert.deepEqual(new Uint8Array(buffer), bytes(1, 2));
  });

  it('never returns an empty buffer for a non-empty image', () => {
    // The bug this whole path exists for: an upload body of zero bytes.
    const blob = new Uint8Array(1_024).fill(7);
    assert.equal(base64ToArrayBuffer(encode(blob)).byteLength, 1_024);
  });
});
