/**
 * Stored plan wizard answers (profiles.plan_wizard_answers, local copy in MMKV).
 * Only the answers about the person are kept — goal, days, minutes, gear,
 * assessment, cardio. Focus and scope start fresh on every run.
 *
 * Pure: parsing is strict per field, so an old or hand-edited value only
 * loses the fields that no longer fit.
 */

import { PLAN_EQUIPMENT, type PlanEquipment } from '@/lib/workouts/plan-catalog';
import {
  ASSESSMENT_LEVELS,
  PLAN_CARDIO,
  PLAN_DAYS,
  PLAN_GOALS,
  PLAN_MINUTES,
  type AssessmentLevel,
  type PlanAssessment,
  type PlanWizardAnswers,
} from '@/lib/workouts/plan-builder';

export type StoredPlanWizardAnswers = Pick<
  PlanWizardAnswers,
  'goal' | 'days' | 'minutes' | 'equipment' | 'assessment' | 'cardio'
>;

export const DEFAULT_PLAN_WIZARD_ANSWERS: PlanWizardAnswers = {
  goal: 'muscle',
  days: 3,
  minutes: 45,
  equipment: [],
  assessment: { push: 1, pull: 0, legs: 1 },
  focus: 'balanced',
  cardio: 'none',
  scope: 'full',
};

function pick<T>(allowed: readonly T[], value: unknown): T | undefined {
  return allowed.includes(value as T) ? (value as T) : undefined;
}

function parseAssessment(raw: unknown): PlanAssessment | undefined {
  if (raw == null || typeof raw !== 'object') {
    return undefined;
  }
  const record = raw as Record<string, unknown>;
  const push = pick<AssessmentLevel>(ASSESSMENT_LEVELS, record.push);
  const pull = pick<AssessmentLevel>(ASSESSMENT_LEVELS, record.pull);
  const legs = pick<AssessmentLevel>(ASSESSMENT_LEVELS, record.legs);
  if (push == null || pull == null || legs == null) {
    return undefined;
  }
  return { push, pull, legs };
}

function parseEquipment(raw: unknown): PlanEquipment[] | undefined {
  if (!Array.isArray(raw)) {
    return undefined;
  }
  // Keep catalog order and drop unknown or repeated entries.
  return PLAN_EQUIPMENT.filter((item) => raw.includes(item));
}

/** Valid stored fields only; null when nothing usable is there. */
export function parseStoredPlanWizardAnswers(raw: unknown): Partial<StoredPlanWizardAnswers> | null {
  if (raw == null || typeof raw !== 'object' || Array.isArray(raw)) {
    return null;
  }
  const record = raw as Record<string, unknown>;
  const goal = pick(PLAN_GOALS, record.goal);
  const days = pick(PLAN_DAYS, record.days);
  const minutes = pick(PLAN_MINUTES, record.minutes);
  const cardio = pick(PLAN_CARDIO, record.cardio);
  const equipment = parseEquipment(record.equipment);
  const assessment = parseAssessment(record.assessment);
  const parsed: Partial<StoredPlanWizardAnswers> = {
    ...(goal ? { goal } : {}),
    ...(days ? { days } : {}),
    ...(minutes ? { minutes } : {}),
    ...(cardio ? { cardio } : {}),
    ...(equipment ? { equipment } : {}),
    ...(assessment ? { assessment } : {}),
  };
  return Object.keys(parsed).length > 0 ? parsed : null;
}

/** Wizard start values: defaults, overlaid with whatever was stored. */
export function initialPlanWizardAnswers(stored: unknown): PlanWizardAnswers {
  const parsed = parseStoredPlanWizardAnswers(stored);
  return { ...DEFAULT_PLAN_WIZARD_ANSWERS, ...(parsed ?? {}) };
}

export function toStoredPlanWizardAnswers(answers: PlanWizardAnswers): StoredPlanWizardAnswers {
  return {
    goal: answers.goal,
    days: answers.days,
    minutes: answers.minutes,
    equipment: [...answers.equipment],
    assessment: { ...answers.assessment },
    cardio: answers.cardio,
  };
}
