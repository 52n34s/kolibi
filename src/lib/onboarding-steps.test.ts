import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  buildOnboardingSteps,
  estimateLegacyOnboardingSeconds,
  estimateOnboardingSeconds,
  onboardingStepIndex,
  resolveOnboardingPreviewStep,
} from './onboarding-steps.ts';

describe('buildOnboardingSteps', () => {
  it('first run: usage question first, summary last, diet gone', () => {
    const steps = buildOnboardingSteps({ isReviewMode: false });
    assert.deepEqual(
      steps.map((step) => step.id),
      ['purpose', 'about', 'height', 'weight', 'activity', 'goal', 'summary'],
    );
    assert.equal(steps.some((step) => (step.id as string) === 'diet'), false);
  });

  it('legal notice only on the first step of a first run', () => {
    const steps = buildOnboardingSteps({ isReviewMode: false });
    assert.deepEqual(
      steps.filter((step) => step.showsLegalNotice).map((step) => step.id),
      ['purpose'],
    );
    const review = buildOnboardingSteps({ isReviewMode: true });
    assert.equal(review.some((step) => step.showsLegalNotice), false);
  });

  it('skip on every step but the summary; never in review mode', () => {
    const steps = buildOnboardingSteps({ isReviewMode: false });
    assert.deepEqual(
      steps.filter((step) => !step.skippable).map((step) => step.id),
      ['summary'],
    );
    const review = buildOnboardingSteps({ isReviewMode: true });
    assert.equal(review.some((step) => step.skippable), false);
  });

  it('only the usage question is optional', () => {
    const steps = buildOnboardingSteps({ isReviewMode: false });
    assert.deepEqual(
      steps.filter((step) => !step.required).map((step) => step.id),
      ['purpose'],
    );
  });
});

describe('estimates', () => {
  it('7 steps, faster than the 8-step onboarding', () => {
    const steps = buildOnboardingSteps({ isReviewMode: false });
    assert.equal(steps.length, 7);
    assert.equal(estimateLegacyOnboardingSeconds(), 76);
    assert.equal(estimateOnboardingSeconds(steps), 68);
  });
});

describe('step lookup', () => {
  const steps = buildOnboardingSteps({ isReviewMode: true });

  it('finds steps by id', () => {
    assert.equal(onboardingStepIndex(steps, 'goal'), 5);
    assert.equal(onboardingStepIndex(steps, 'purpose'), 0);
  });

  it('resolves a preview/start param by id or index', () => {
    assert.equal(resolveOnboardingPreviewStep('goal', steps), 5);
    assert.equal(resolveOnboardingPreviewStep('2', steps), 2);
    assert.equal(resolveOnboardingPreviewStep('7', steps), null);
    assert.equal(resolveOnboardingPreviewStep('diet', steps), null);
    assert.equal(resolveOnboardingPreviewStep(undefined, steps), null);
    assert.equal(resolveOnboardingPreviewStep('', steps), null);
  });
});
