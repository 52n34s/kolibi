import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { keepSessionForUser, sessionOwnership } from './session-owner.ts';
import type { ActiveSession } from './types.ts';

function session(userId: unknown): ActiveSession {
  return {
    sessionId: 'sess-1',
    userId: userId as string,
    templateId: 't1',
    templateName: 'Push',
    shortLabel: 'Ps',
    colorKey: 'teal',
    startedAt: '2026-09-22T09:00:00.000Z',
    loggedOn: '2026-09-22',
    finishedAt: null,
    intensity: null,
    trainingSessionId: null,
    phase: 'active',
    items: [],
    cursor: { exerciseIndex: 0, setIndex: 0 },
  };
}

describe('sessionOwnership', () => {
  it('keeps a session that belongs to the signed-in user', () => {
    assert.equal(sessionOwnership(session('user-a'), 'user-a'), 'keep');
  });

  it('flags a session from another account', () => {
    assert.equal(sessionOwnership(session('user-a'), 'user-b'), 'foreign');
  });

  it('flags a session with no owner (written before userId existed)', () => {
    assert.equal(sessionOwnership(session(undefined), 'user-a'), 'unowned');
    assert.equal(sessionOwnership(session(''), 'user-a'), 'unowned');
  });

  it('reports no-user while signed out', () => {
    assert.equal(sessionOwnership(session('user-a'), null), 'no-user');
    assert.equal(sessionOwnership(session('user-a'), ''), 'no-user');
  });

  it('reports no-session for nothing stored', () => {
    assert.equal(sessionOwnership(null, 'user-a'), 'no-session');
    assert.equal(sessionOwnership(undefined, 'user-a'), 'no-session');
  });
});

describe('keepSessionForUser', () => {
  it('returns the session only for its owner', () => {
    const mine = session('user-a');
    assert.equal(keepSessionForUser(mine, 'user-a'), mine);
  });

  it('drops a session from a previous account', () => {
    assert.equal(keepSessionForUser(session('user-a'), 'user-b'), null);
  });

  it('drops an unowned session', () => {
    assert.equal(keepSessionForUser(session(undefined), 'user-a'), null);
  });

  it('drops everything while signed out', () => {
    assert.equal(keepSessionForUser(session('user-a'), null), null);
  });
});
