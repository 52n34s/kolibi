/**
 * Check-in scale conversion. Every question reads left→right on screen as
 * bad→good, and buttons always show digits 1 (left) … 5 (right) in that
 * order. Sleep/energy already store that way (1 = bad, 5 = good — see
 * CheckinAnswers in readiness.ts). Soreness/stress store the opposite
 * (1 = good, 5 = bad), and daily_checkins, wellnessScore, rateCheckin and
 * sorenessHigh all depend on that stored direction staying exactly as it
 * is — so only the *displayed* digit is flipped for them, never the stored
 * one: displayed = 6 − stored. That map is its own inverse, so the same
 * formula converts stored → displayed and displayed → stored.
 */
const REVERSED_SCALE_QUESTIONS = new Set(['soreness', 'stress']);

export function isReversedCheckinScale(question: string): boolean {
  return REVERSED_SCALE_QUESTIONS.has(question);
}

/** The digit shown on screen (1 = left/bad … 5 = right/good) for a stored answer. */
export function toDisplayedCheckinValue(question: string, stored: number): number {
  return isReversedCheckinScale(question) ? 6 - stored : stored;
}

/** What gets saved — matches the existing CheckinAnswers convention — for a tapped display digit. */
export function toStoredCheckinValue(question: string, displayed: number): number {
  return isReversedCheckinScale(question) ? 6 - displayed : displayed;
}

/** Which end-label json key (`checkin.scale.<question>.<key>`) goes on the left and right. */
export function checkinScaleLabelOrder(question: string): readonly ['low' | 'high', 'low' | 'high'] {
  return isReversedCheckinScale(question) ? (['high', 'low'] as const) : (['low', 'high'] as const);
}
