/**
 * Display order for the check-in scale. All four questions read left→right
 * as bad→good, but sleep/energy already store 5 = good while soreness/stress
 * store 1 = good (see CheckinAnswers in readiness.ts). So soreness and stress
 * render their buttons and end-labels reversed — the stored 1-5 values, the
 * wellness formula and existing check-ins never change.
 */
const REVERSED_SCALE_QUESTIONS = new Set(['soreness', 'stress']);

export function isReversedCheckinScale(question: string): boolean {
  return REVERSED_SCALE_QUESTIONS.has(question);
}

export function orderedCheckinSteps<T>(steps: readonly T[], question: string): readonly T[] {
  return isReversedCheckinScale(question) ? [...steps].reverse() : steps;
}

export function checkinScaleLabelOrder(question: string): readonly ['low' | 'high', 'low' | 'high'] {
  return isReversedCheckinScale(question) ? (['high', 'low'] as const) : (['low', 'high'] as const);
}
