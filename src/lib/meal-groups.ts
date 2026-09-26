/**
 * Automatic meal grouping (display and analysis only — nothing is stored).
 *
 * Grouping (chain rule): entries of the same local calendar day belong to one
 * meal when each entry was logged at most 45 minutes after the previous entry
 * of that meal. A chain can therefore span more than 45 minutes in total.
 * Exactly 45:00 still joins; anything later starts a new meal. Entries on
 * different local days never share a meal, even across midnight.
 *
 * Naming by the meal's start time (device-local clock):
 *   04:00–10:59  breakfast
 *   11:00–14:59  lunch
 *   15:00–17:29  snack (afternoon snack)
 *   17:30–23:59  dinner
 *   00:00–03:59  snack (night — outside the main times)
 *
 * One main name per window and day: when several meals start inside the same
 * breakfast / lunch / dinner window, the one with the most kcal keeps the main
 * name (ties → the earlier one) and the others become snacks.
 */

export type MealSlot = 'breakfast' | 'lunch' | 'snack' | 'dinner';

export const MEAL_GROUP_MAX_GAP_MINUTES = 45;

const MAX_GAP_MS = MEAL_GROUP_MAX_GAP_MINUTES * 60 * 1000;

/** Minutes after local midnight where each window starts. */
const BREAKFAST_FROM_MIN = 4 * 60;
const LUNCH_FROM_MIN = 11 * 60;
const AFTERNOON_SNACK_FROM_MIN = 15 * 60;
const DINNER_FROM_MIN = 17 * 60 + 30;

export type MealGroupAccessors<T> = {
  eatenAt: (entry: T) => string | Date;
  kcal: (entry: T) => number;
};

export type MealGroup<T> = {
  /** Local calendar day, YYYY-MM-DD. */
  dateKey: string;
  slot: MealSlot;
  /** First entry's timestamp. */
  startAt: Date;
  /** Last entry's timestamp. */
  endAt: Date;
  totalKcal: number;
  /** Chronological (oldest first). */
  entries: T[];
};

/**
 * Same format as `localDateKey` in day-window (not imported there: that module
 * pulls in expo-localization, which node tests cannot load).
 */
function localDayKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Time window for a local start time, before the one-main-name-per-day rule. */
export function mealSlotForStartTime(start: Date): MealSlot {
  const minutes = start.getHours() * 60 + start.getMinutes();
  if (minutes < BREAKFAST_FROM_MIN) {
    return 'snack';
  }
  if (minutes < LUNCH_FROM_MIN) {
    return 'breakfast';
  }
  if (minutes < AFTERNOON_SNACK_FROM_MIN) {
    return 'lunch';
  }
  if (minutes < DINNER_FROM_MIN) {
    return 'snack';
  }
  return 'dinner';
}

function toDate(value: string | Date): Date {
  return value instanceof Date ? value : new Date(value);
}

/**
 * Groups entries into meals. Input order does not matter; entries with an
 * invalid timestamp are skipped. Groups come back oldest first.
 */
export function groupMeals<T>(
  entries: readonly T[],
  accessors: MealGroupAccessors<T>,
): MealGroup<T>[] {
  const sorted = entries
    .map((entry) => ({ entry, at: toDate(accessors.eatenAt(entry)) }))
    .filter((row) => !Number.isNaN(row.at.getTime()))
    .sort((a, b) => a.at.getTime() - b.at.getTime());

  const groups: MealGroup<T>[] = [];
  let current: MealGroup<T> | null = null;

  for (const { entry, at } of sorted) {
    const dateKey = localDayKey(at);
    const joins =
      current != null &&
      current.dateKey === dateKey &&
      at.getTime() - current.endAt.getTime() <= MAX_GAP_MS;

    if (joins && current) {
      current.entries.push(entry);
      current.endAt = at;
      current.totalKcal += Number(accessors.kcal(entry)) || 0;
      continue;
    }

    current = {
      dateKey,
      slot: mealSlotForStartTime(at),
      startAt: at,
      endAt: at,
      totalKcal: Number(accessors.kcal(entry)) || 0,
      entries: [entry],
    };
    groups.push(current);
  }

  demoteExtraMainMeals(groups);
  return groups;
}

export type MealGroupLabel = 'breakfast' | 'lunch' | 'afternoonSnack' | 'snack' | 'dinner';

/**
 * Display name key. A snack that starts in the 15:00–17:29 window is the
 * afternoon snack (ES "Merienda"); every other snack keeps the plain name.
 */
export function mealGroupLabel(
  group: Pick<MealGroup<unknown>, 'slot' | 'startAt'>,
): MealGroupLabel {
  if (group.slot !== 'snack') {
    return group.slot;
  }
  const minutes = group.startAt.getHours() * 60 + group.startAt.getMinutes();
  return minutes >= AFTERNOON_SNACK_FROM_MIN && minutes < DINNER_FROM_MIN
    ? 'afternoonSnack'
    : 'snack';
}

/**
 * A group with a single entry starts open (the header alone would hide the
 * only meal); larger groups start closed. A tap flips the start state, so
 * `toggled` holds the keys the user tapped an odd number of times.
 */
export function isMealGroupExpanded(
  group: { entries: readonly unknown[] },
  groupKey: string,
  toggled: ReadonlySet<string>,
): boolean {
  const openByDefault = group.entries.length === 1;
  return toggled.has(groupKey) ? !openByDefault : openByDefault;
}

export type MealGroupMacroTotals = {
  kcal: number;
  proteinG: number | null;
  carbsG: number | null;
  fatG: number | null;
  fiberG: number | null;
};

/**
 * Header totals for a meal row: kcal sum, and per macro the sum of the
 * entries that have it (null only when no entry in the group has that
 * macro at all) — same "unknown vs. zero" rule as a single entry.
 */
export function sumMealGroupTotals(
  entries: readonly {
    kcal: number;
    proteinG: number | null;
    carbsG?: number | null;
    fatG?: number | null;
    fiberG?: number | null;
  }[],
): MealGroupMacroTotals {
  let kcal = 0;
  let proteinG: number | null = null;
  let carbsG: number | null = null;
  let fatG: number | null = null;
  let fiberG: number | null = null;
  for (const entry of entries) {
    kcal += Number(entry.kcal) || 0;
    if (entry.proteinG != null) {
      proteinG = (proteinG ?? 0) + entry.proteinG;
    }
    if (entry.carbsG != null) {
      carbsG = (carbsG ?? 0) + entry.carbsG;
    }
    if (entry.fatG != null) {
      fatG = (fatG ?? 0) + entry.fatG;
    }
    if (entry.fiberG != null) {
      fiberG = (fiberG ?? 0) + entry.fiberG;
    }
  }
  return { kcal, proteinG, carbsG, fatG, fiberG };
}

export type MacroAbbrevLabels = {
  protein: string;
  carbs: string;
  fat: string;
  fiber: string;
};

/**
 * "17 g P · 108 g K · 11 g F · 8 g B" — same format and rounding as a single
 * entry's macro line; a macro is left out entirely (not "0 g") when null.
 */
export function formatMacroTotalsLine(
  totals: { proteinG: number | null; carbsG: number | null; fatG: number | null; fiberG: number | null },
  labels: MacroAbbrevLabels,
): string | null {
  const parts: string[] = [];
  if (totals.proteinG != null) {
    parts.push(`${Math.round(totals.proteinG)} g ${labels.protein}`);
  }
  if (totals.carbsG != null) {
    parts.push(`${Math.round(totals.carbsG)} g ${labels.carbs}`);
  }
  if (totals.fatG != null) {
    parts.push(`${Math.round(totals.fatG)} g ${labels.fat}`);
  }
  if (totals.fiberG != null) {
    parts.push(`${Math.round(totals.fiberG)} g ${labels.fiber}`);
  }
  return parts.length > 0 ? parts.join(' · ') : null;
}

/** Keeps one breakfast / lunch / dinner per day (most kcal wins); others → snack. */
function demoteExtraMainMeals<T>(groups: MealGroup<T>[]): void {
  const winners = new Map<string, MealGroup<T>>();
  for (const group of groups) {
    if (group.slot === 'snack') {
      continue;
    }
    const key = `${group.dateKey}|${group.slot}`;
    const best = winners.get(key);
    if (best == null || group.totalKcal > best.totalKcal) {
      winners.set(key, group);
    }
  }
  for (const group of groups) {
    if (group.slot === 'snack') {
      continue;
    }
    if (winners.get(`${group.dateKey}|${group.slot}`) !== group) {
      group.slot = 'snack';
    }
  }
}
