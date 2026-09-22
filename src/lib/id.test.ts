import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it } from 'node:test';

import { newId } from './id.ts';

const UUID_V4 =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

describe('newId', () => {
  it('matches the RFC-4122 v4 shape including version and variant bits', () => {
    for (let run = 0; run < 500; run += 1) {
      const id = newId();
      assert.match(id, UUID_V4, `unexpected shape: ${id}`);
      assert.equal(id.length, 36);
      assert.equal(id[14], '4', `version nibble wrong: ${id}`);
      assert.ok('89ab'.includes(id[19] ?? ''), `variant nibble wrong: ${id}`);
      assert.equal(id, id.toLowerCase());
    }
  });

  it('produces 10000 ids without a duplicate', () => {
    const seen = new Set<string>();
    for (let run = 0; run < 10_000; run += 1) {
      seen.add(newId());
    }
    assert.equal(seen.size, 10_000);
  });

  it('still works when globalThis.crypto is missing (Hermes)', () => {
    const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'crypto');
    // @ts-expect-error -- deliberately removing a global to simulate Hermes
    delete globalThis.crypto;

    try {
      assert.equal(globalThis.crypto, undefined);
      const ids = new Set<string>();
      for (let run = 0; run < 1000; run += 1) {
        const id = newId();
        assert.match(id, UUID_V4, `unexpected shape without crypto: ${id}`);
        ids.add(id);
      }
      assert.equal(ids.size, 1000);
    } finally {
      if (descriptor) {
        Object.defineProperty(globalThis, 'crypto', descriptor);
      }
    }
  });

  it('survives a crypto global whose getter throws', () => {
    const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'crypto');
    Object.defineProperty(globalThis, 'crypto', {
      configurable: true,
      get() {
        throw new Error('no crypto here');
      },
    });

    try {
      assert.match(newId(), UUID_V4);
    } finally {
      if (descriptor) {
        Object.defineProperty(globalThis, 'crypto', descriptor);
      } else {
        // @ts-expect-error -- restoring the absent-global case
        delete globalThis.crypto;
      }
    }
  });
});

/**
 * Guard rail: `crypto.randomUUID` is undefined in Hermes, so a single stray
 * call crashes the feature on device while every Node test stays green.
 */
describe('crypto usage across src/', () => {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const srcRoot = path.resolve(here, '..');
  const allowed = path.join(srcRoot, 'lib', 'id.ts');

  function collectFiles(dir: string, out: string[]): string[] {
    for (const entry of readdirSync(dir)) {
      if (entry === 'node_modules' || entry.startsWith('.')) {
        continue;
      }
      const full = path.join(dir, entry);
      if (statSync(full).isDirectory()) {
        collectFiles(full, out);
        continue;
      }
      if (!/\.(ts|tsx)$/.test(entry) || /\.test\.tsx?$/.test(entry)) {
        continue;
      }
      if (full === allowed) {
        continue;
      }
      out.push(full);
    }
    return out;
  }

  it('has no randomUUID or globalThis.crypto outside lib/id.ts', () => {
    const offenders: string[] = [];

    for (const file of collectFiles(srcRoot, [])) {
      const lines = readFileSync(file, 'utf8').split('\n');
      lines.forEach((line, index) => {
        if (line.includes('randomUUID') || line.includes('globalThis.crypto')) {
          offenders.push(`${path.relative(srcRoot, file)}:${index + 1}: ${line.trim()}`);
        }
      });
    }

    assert.deepEqual(
      offenders,
      [],
      `Use newId() from @/lib/id instead:\n${offenders.join('\n')}`,
    );
  });
});
