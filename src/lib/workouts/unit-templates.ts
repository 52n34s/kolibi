import type { SaveTemplateInput } from './workouts-api';
import type { WorkoutTemplate } from './types';

/**
 * Units, own templates and archived units share workout_templates:
 * a unit has is_template = false (active while archived_at is null), a template
 * has is_template = true. Every copy goes through save_workout_template, so a
 * copy is independent of its source: own id, own exercise rows and targets.
 */
export type UnitTemplateBackend = {
  saveTemplate(input: SaveTemplateInput): Promise<string>;
  setTemplateFlag(templateId: string, isTemplate: boolean): Promise<void>;
  archiveTemplate(templateId: string): Promise<void>;
  restoreTemplate(templateId: string): Promise<void>;
};

/** Save input for an independent copy: no id, same exercises and targets. */
export function copyInputFromUnit(
  unit: WorkoutTemplate,
  overrides: { name?: string; position?: number; weekdays?: number[] } = {},
): SaveTemplateInput {
  return {
    id: null,
    name: overrides.name ?? unit.name,
    shortLabel: unit.shortLabel,
    colorKey: unit.colorKey,
    weekdays: overrides.weekdays ?? [],
    position: overrides.position ?? unit.position,
    exercises: [...unit.exercises]
      .sort((a, b) => a.position - b.position)
      .map((item) => ({
        exerciseId: item.exerciseId,
        targetSets: item.targetSets,
        targetReps: item.targetReps,
        targetRepsMax: item.targetRepsMax,
        targetSeconds: item.targetSeconds,
        targetSecondsMax: item.targetSecondsMax,
        targetWeightKg: item.targetWeightKg,
        restSeconds: item.restSeconds,
      })),
  };
}

/**
 * Copies a unit into "Meine Vorlagen". The row is saved as a unit first and
 * flagged afterwards; if flagging fails, the copy is archived at once so it
 * never shows up as an extra unit, and the error is passed on.
 */
export async function saveAsTemplate(
  backend: UnitTemplateBackend,
  unit: WorkoutTemplate,
): Promise<string> {
  const id = await backend.saveTemplate(copyInputFromUnit(unit, { position: 0 }));
  try {
    await backend.setTemplateFlag(id, true);
  } catch (error) {
    await backend.archiveTemplate(id).catch(() => undefined);
    throw error;
  }
  return id;
}

/** New unit from a template (own or Kolibi), appended at `position`. */
export async function createUnitFromTemplate(
  backend: UnitTemplateBackend,
  template: WorkoutTemplate,
  position: number,
): Promise<string> {
  return backend.saveTemplate(copyInputFromUnit(template, { position }));
}

export async function archiveUnit(backend: UnitTemplateBackend, unit: WorkoutTemplate) {
  await backend.archiveTemplate(unit.id);
}

export async function restoreUnit(backend: UnitTemplateBackend, unit: WorkoutTemplate) {
  await backend.restoreTemplate(unit.id);
}

/** Renames an own template in place; exercises and targets stay as they are. */
export async function renameTemplate(
  backend: UnitTemplateBackend,
  template: WorkoutTemplate,
  name: string,
): Promise<void> {
  const input = copyInputFromUnit(template, { name, weekdays: template.weekdays });
  await backend.saveTemplate({ ...input, id: template.id });
}

/** "Löschen" of an own template hides it; nothing is removed from the database. */
export async function removeTemplate(backend: UnitTemplateBackend, template: WorkoutTemplate) {
  await backend.archiveTemplate(template.id);
}
