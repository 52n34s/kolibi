import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { kolibiTemplateCards, singleSessionPlan } from './kolibi-templates.ts';

describe('kolibiTemplateCards', () => {
  const cards = kolibiTemplateCards();

  it('offers the four presets', () => {
    const presets = new Set(cards.map((card) => card.preset.id));
    assert.deepEqual(
      [...presets].sort(),
      ['chest_shoulders_focus', 'full_body_beginner', 'push_pull_legs_advanced', 'short_20'],
    );
  });

  it('splits the beginner full body plan into A and B', () => {
    const beginner = cards.filter((card) => card.preset.id === 'full_body_beginner');
    assert.deepEqual(
      beginner.map((card) => card.session.kind),
      ['full_a', 'full_b'],
    );
  });

  it('gives every card exercises and a unique key', () => {
    assert.ok(cards.every((card) => card.session.exercises.length > 0));
    assert.equal(new Set(cards.map((card) => card.key)).size, cards.length);
  });

  it('keeps the short session at three exercises', () => {
    const short = cards.filter((card) => card.preset.id === 'short_20');
    assert.ok(short.length >= 1);
    assert.ok(short.every((card) => card.session.exercises.length === 3));
  });
});

describe('singleSessionPlan', () => {
  it('saves one session without touching the weekly goal', () => {
    const [card] = kolibiTemplateCards();
    const plan = singleSessionPlan(card!.session);
    assert.equal(plan.sessionsPerWeek, null);
    assert.equal(plan.sessions.length, 1);
  });
});
