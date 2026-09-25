/**
 * Fixed "Kolibi-Vorlagen": buildPlan with fixed answers, so curated templates
 * follow the same rules (ladders, ranges, rests) as the plan wizard.
 */

import { buildPlan, type BuiltPlan, type PlanWizardAnswers } from '@/lib/workouts/plan-builder';

export type KolibiTemplatePresetId =
  | 'full_body_beginner'
  | 'push_pull_legs_advanced'
  | 'chest_shoulders_focus'
  | 'short_20';

export type KolibiTemplatePreset = {
  id: KolibiTemplatePresetId;
  /** i18n keys under planWizard.presets. */
  titleKey: string;
  subtitleKey: string;
  answers: PlanWizardAnswers;
};

export const KOLIBI_TEMPLATE_PRESETS: readonly KolibiTemplatePreset[] = [
  {
    // Ganzkörper Einsteiger A/B
    id: 'full_body_beginner',
    titleKey: 'planWizard.presets.full_body_beginner.title',
    subtitleKey: 'planWizard.presets.full_body_beginner.subtitle',
    answers: {
      goal: 'fitness',
      days: 2,
      minutes: 30,
      equipment: [],
      assessment: { push: 0, pull: 0, legs: 0 },
      focus: 'balanced',
      cardio: 'none',
      scope: 'full',
    },
  },
  {
    // Push / Pull & Legs Fortgeschritten
    id: 'push_pull_legs_advanced',
    titleKey: 'planWizard.presets.push_pull_legs_advanced.title',
    subtitleKey: 'planWizard.presets.push_pull_legs_advanced.subtitle',
    answers: {
      goal: 'muscle',
      days: 4,
      minutes: 60,
      equipment: ['bar'],
      assessment: { push: 2, pull: 2, legs: 2 },
      focus: 'balanced',
      cardio: 'none',
      scope: 'full',
    },
  },
  {
    // Brust und Schultern Fokus
    id: 'chest_shoulders_focus',
    titleKey: 'planWizard.presets.chest_shoulders_focus.title',
    subtitleKey: 'planWizard.presets.chest_shoulders_focus.subtitle',
    answers: {
      goal: 'muscle',
      days: 3,
      minutes: 45,
      equipment: [],
      assessment: { push: 1, pull: 1, legs: 1 },
      focus: 'chest_shoulders',
      cardio: 'none',
      scope: 'single',
    },
  },
  {
    // Kurz-Einheit 20 Minuten
    id: 'short_20',
    titleKey: 'planWizard.presets.short_20.title',
    subtitleKey: 'planWizard.presets.short_20.subtitle',
    answers: {
      goal: 'fitness',
      days: 3,
      minutes: 20,
      equipment: [],
      assessment: { push: 1, pull: 1, legs: 1 },
      focus: 'balanced',
      cardio: 'none',
      scope: 'single',
    },
  },
];

export function getKolibiTemplatePreset(id: KolibiTemplatePresetId): KolibiTemplatePreset {
  const preset = KOLIBI_TEMPLATE_PRESETS.find((entry) => entry.id === id);
  if (!preset) {
    throw new Error(`unknown_kolibi_template_preset:${id}`);
  }
  return preset;
}

/** The preset's plan, built by the same rules as the wizard. */
export function buildKolibiTemplate(id: KolibiTemplatePresetId): BuiltPlan {
  return buildPlan(getKolibiTemplatePreset(id).answers);
}
