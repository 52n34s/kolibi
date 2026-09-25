import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  DEFAULT_PLAN_WIZARD_ANSWERS,
  initialPlanWizardAnswers,
  parseStoredPlanWizardAnswers,
  toStoredPlanWizardAnswers,
} from './plan-wizard-answers.ts';

describe('plan wizard answers', () => {
  it('round-trips the stored fields and leaves focus and scope out', () => {
    const answers = {
      ...DEFAULT_PLAN_WIZARD_ANSWERS,
      goal: 'fat_loss' as const,
      days: 5 as const,
      minutes: 20 as const,
      equipment: ['rings' as const, 'bar' as const],
      assessment: { push: 3 as const, pull: 2 as const, legs: 0 as const },
      focus: 'legs' as const,
      cardio: 'lots' as const,
      scope: 'single' as const,
    };
    const stored = toStoredPlanWizardAnswers(answers);
    assert.equal('focus' in stored, false);
    assert.equal('scope' in stored, false);

    const restored = initialPlanWizardAnswers(JSON.parse(JSON.stringify(stored)));
    assert.deepEqual(restored, {
      ...answers,
      equipment: ['bar', 'rings'],
      focus: 'balanced',
      scope: 'full',
    });
  });

  it('keeps valid fields and drops the rest', () => {
    assert.deepEqual(
      parseStoredPlanWizardAnswers({
        goal: 'yoga',
        days: 4,
        minutes: 90,
        equipment: ['bar', 'bar', 'kettlebell'],
        assessment: { push: 1, pull: 7, legs: 2 },
        cardio: 'some',
      }),
      { days: 4, cardio: 'some', equipment: ['bar'] },
    );
  });

  it('falls back to defaults for missing or broken values', () => {
    assert.equal(parseStoredPlanWizardAnswers(null), null);
    assert.equal(parseStoredPlanWizardAnswers([]), null);
    assert.equal(parseStoredPlanWizardAnswers({ goal: 1 }), null);
    assert.deepEqual(initialPlanWizardAnswers(undefined), DEFAULT_PLAN_WIZARD_ANSWERS);
    assert.deepEqual(initialPlanWizardAnswers('{"goal":"muscle"}'), DEFAULT_PLAN_WIZARD_ANSWERS);
  });
});
