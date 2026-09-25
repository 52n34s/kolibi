import { KOLIBI_TEMPLATE_PRESETS, type KolibiTemplatePreset } from './kolibi-template-presets';
import { buildPlan, type BuiltPlan, type BuiltPlanSession } from './plan-builder';

/** One "Kolibi-Vorlage": a session of a fixed preset plan, e.g. "Ganzkörper A". */
export type KolibiTemplateCard = {
  key: string;
  preset: KolibiTemplatePreset;
  session: BuiltPlanSession;
};

/** Every session of every preset, built with the plan wizard's rules. */
export function kolibiTemplateCards(
  presets: readonly KolibiTemplatePreset[] = KOLIBI_TEMPLATE_PRESETS,
): KolibiTemplateCard[] {
  return presets.flatMap((preset) =>
    buildPlan(preset.answers)
      .sessions.filter((session) => session.exercises.length > 0)
      .map((session, index) => ({ key: `${preset.id}:${index}`, preset, session })),
  );
}

/** A single session as a plan to save through applyBuiltPlan (weekly goal untouched). */
export function singleSessionPlan(session: BuiltPlanSession): BuiltPlan {
  return { sessionsPerWeek: null, sessions: [session], notes: [] };
}
