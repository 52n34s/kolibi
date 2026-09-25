import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { createSingleFlight } from './single-flight';

describe('createSingleFlight', () => {
  it('a second call while the first runs gets the same promise (double tap on Fertig)', async () => {
    const run = createSingleFlight<number>();
    let calls = 0;
    let release: (value: number) => void = () => {};
    const task = () => {
      calls += 1;
      return new Promise<number>((resolve) => {
        release = resolve;
      });
    };
    const first = run('s1', task);
    const second = run('s1', task);
    assert.equal(first, second);
    await Promise.resolve();
    release(7);
    assert.equal(await first, 7);
    assert.equal(calls, 1);
  });

  it('runs again after the first one settled, also after a failure', async () => {
    const run = createSingleFlight<string>();
    let calls = 0;
    await assert.rejects(
      run('s1', async () => {
        calls += 1;
        throw new Error('offline');
      }),
      /offline/,
    );
    assert.equal(await run('s1', async () => {
      calls += 1;
      return 'ok';
    }), 'ok');
    assert.equal(calls, 2);
  });

  it('keys run independently', async () => {
    const run = createSingleFlight<string>();
    const [a, b] = await Promise.all([run('a', async () => 'a'), run('b', async () => 'b')]);
    assert.deepEqual([a, b], ['a', 'b']);
  });
});
