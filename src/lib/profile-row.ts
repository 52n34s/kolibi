import { clampFocusAreas, type FocusAreaId } from '@/lib/focus-areas';

/**
 * The optional profile columns as the select hands them back: absent before
 * their migration, numbers possibly as strings. Parsed here so nothing typed
 * `unknown` leaves the profile module.
 */
export type MovementGoalType = 'steps' | 'running_km' | 'distance_km';
export type MovementGoalPeriod = 'day' | 'week';

export type OptionalProfileColumns = {
  diet_preference: string | null;
  cuisine_context: string[] | null;
  movement_goal_type: MovementGoalType | null;
  movement_goal_value: number | null;
  movement_goal_period: MovementGoalPeriod | null;
  target_weight_kg: number | null;
  progress_start_date: string | null;
  training_sessions_per_week: number | null;
  focus_areas: FocusAreaId[] | null;
  /** Local date key (YYYY-MM-DD) the lighter week ends on. */
  deload_until: string | null;
  /** ISO timestamp of the last deload suggestion. */
  deload_suggested_at: string | null;
};

export type OptionalProfileRow = Partial<Record<keyof OptionalProfileColumns, unknown>>;

const DATE_KEY = /^\d{4}-\d{2}-\d{2}$/;

function stringOrNull(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function finiteOrNull(value: unknown): number | null {
  if (value == null || value === '') {
    return null;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function parseMovementGoalType(value: unknown): MovementGoalType | null {
  return value === 'steps' || value === 'running_km' || value === 'distance_km' ? value : null;
}

export function parseMovementGoalPeriod(value: unknown): MovementGoalPeriod | null {
  return value === 'day' || value === 'week' ? value : null;
}

export function parseOptionalProfileColumns(row: OptionalProfileRow): OptionalProfileColumns {
  const sessions = finiteOrNull(row.training_sessions_per_week);
  // A date column comes back as YYYY-MM-DD; anything else is not a date key.
  const deloadUntil = stringOrNull(row.deload_until);
  return {
    diet_preference: stringOrNull(row.diet_preference),
    cuisine_context: Array.isArray(row.cuisine_context) ? row.cuisine_context.map(String) : null,
    movement_goal_type: parseMovementGoalType(row.movement_goal_type),
    movement_goal_value: finiteOrNull(row.movement_goal_value),
    movement_goal_period: parseMovementGoalPeriod(row.movement_goal_period),
    target_weight_kg: finiteOrNull(row.target_weight_kg),
    progress_start_date: stringOrNull(row.progress_start_date),
    training_sessions_per_week: sessions != null && sessions >= 1 && sessions <= 14 ? sessions : null,
    focus_areas: Array.isArray(row.focus_areas) ? clampFocusAreas(row.focus_areas.map(String)) : null,
    deload_until: deloadUntil != null && DATE_KEY.test(deloadUntil) ? deloadUntil : null,
    deload_suggested_at: stringOrNull(row.deload_suggested_at),
  };
}
