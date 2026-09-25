/**
 * Onboarding step order as data. The screen renders by step id, so moving or
 * adding a step changes this list only — no hard-coded indices elsewhere.
 *
 * Core onboarding = what the calorie and macro targets need (birth date,
 * height, weight, activity, goal) plus the usage question up front and the
 * summary with the computed kcal. Biological sex stays as an optional choice
 * on the "about" step: it moves BMR by up to ±83 kcal (Mifflin-St Jeor
 * +5 / −161 vs the mean fallback) for about four seconds of input.
 * Diet preference moved to a one-time card in the meals area.
 */

export type OnboardingStepId =
  | 'purpose'
  | 'about'
  | 'height'
  | 'weight'
  | 'activity'
  | 'goal'
  | 'summary';

export const ONBOARDING_STEP_ORDER = [
  'purpose',
  'about',
  'height',
  'weight',
  'activity',
  'goal',
  'summary',
] as const satisfies readonly OnboardingStepId[];

/** Rough seconds per step for a first-time user (read, decide, tap). */
export const ONBOARDING_STEP_SECONDS = {
  purpose: 5,
  /** Birth date 13 s + optional sex chips 4 s. */
  about: 17,
  height: 7,
  weight: 7,
  activity: 10,
  /** Five choices instead of seven. */
  goal: 12,
  summary: 10,
} as const satisfies Record<OnboardingStepId, number>;

/** Before block 3.1: 8 steps. Kept for the before/after comparison. */
export const LEGACY_ONBOARDING_STEP_SECONDS = {
  diet: 8,
  sex: 6,
  birthDate: 13,
  height: 7,
  weight: 7,
  activity: 10,
  goal: 15,
  summary: 10,
} as const;

export type OnboardingStep = {
  id: OnboardingStepId;
  /** Next stays blocked until the step has a valid answer. */
  required: boolean;
  /** Terms/privacy notice — first step of a first run only. */
  showsLegalNotice: boolean;
  /** Skip link below the buttons. */
  skippable: boolean;
};

const OPTIONAL_STEPS: ReadonlySet<OnboardingStepId> = new Set(['purpose']);

export function buildOnboardingSteps(options: { isReviewMode: boolean }): OnboardingStep[] {
  const lastIndex = ONBOARDING_STEP_ORDER.length - 1;
  return ONBOARDING_STEP_ORDER.map((id, index) => ({
    id,
    required: !OPTIONAL_STEPS.has(id),
    showsLegalNotice: index === 0 && !options.isReviewMode,
    skippable: !options.isReviewMode && index < lastIndex,
  }));
}

export function estimateOnboardingSeconds(steps: readonly { id: OnboardingStepId }[]): number {
  return steps.reduce((sum, step) => sum + ONBOARDING_STEP_SECONDS[step.id], 0);
}

export function estimateLegacyOnboardingSeconds(): number {
  return Object.values(LEGACY_ONBOARDING_STEP_SECONDS).reduce((sum, value) => sum + value, 0);
}

/** Index of a step id, or -1. */
export function onboardingStepIndex(
  steps: readonly { id: OnboardingStepId }[],
  id: OnboardingStepId,
): number {
  return steps.findIndex((step) => step.id === id);
}

/** Dev `previewStep` param: a step id or a zero-based index. */
export function resolveOnboardingPreviewStep(
  raw: string | null | undefined,
  steps: readonly { id: OnboardingStepId }[],
): number | null {
  if (raw == null || raw === '') {
    return null;
  }
  const byId = steps.findIndex((step) => step.id === raw);
  if (byId >= 0) {
    return byId;
  }
  const parsed = Number(raw);
  if (Number.isInteger(parsed) && parsed >= 0 && parsed < steps.length) {
    return parsed;
  }
  return null;
}
