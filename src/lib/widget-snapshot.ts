import * as Sentry from '@sentry/react-native';
import { ExtensionStorage } from '@bacons/apple-targets';
import { Platform } from 'react-native';

export type WidgetMacroSnapshot = {
  label: string;
  value: string;
};

export type WidgetKoliVariant =
  | 'neutral'
  | 'energetic'
  | 'confident'
  | 'focused'
  | 'happy';

export type WidgetCalorieSnapshot = {
  schemaVersion: number;
  dateKey: string;
  remainingValue: string;
  isOverGoal: boolean;
  labelRemaining: string;
  labelFooter: string;
  labelFooterCompact: string;
  macros: WidgetMacroSnapshot[];
  premium: boolean;
  progress: number;
  koliVariant: WidgetKoliVariant;
  updatedAt: string;
};

export const WIDGET_APP_GROUP = 'group.com.steffen.kolibi';
export const WIDGET_CALORIE_SNAPSHOT_KEY = 'calorieSnapshot';
export const WIDGET_CALORIE_SNAPSHOT_SCHEMA_VERSION = 3;

export type BuildWidgetSnapshotInput = {
  dateKey: string;
  remainingValue: string;
  isOverGoal: boolean;
  labelRemaining: string;
  labelFooter: string;
  labelFooterCompact: string;
  macros: WidgetMacroSnapshot[];
  premium: boolean;
  progress: number;
  updatedAt?: string;
};

function clampProgress(progress: number): number {
  if (!Number.isFinite(progress)) {
    return 0;
  }

  return Math.min(1, Math.max(0, progress));
}

/**
 * Maps calorie progress / over-goal state to a Koli illustration key.
 * Deliberately non-judgmental: over-goal uses neutral, not a sad face.
 */
export function resolveKoliVariant(params: {
  isOverGoal: boolean;
  progress: number;
}): WidgetKoliVariant {
  if (params.isOverGoal) {
    return 'neutral';
  }

  const progress = clampProgress(params.progress);

  if (progress < 0.35) {
    return 'energetic';
  }

  if (progress < 0.75) {
    return 'confident';
  }

  if (progress < 0.95) {
    return 'focused';
  }

  return 'happy';
}

/** Comparable payload for write-deduping (excludes updatedAt). */
export function widgetSnapshotComparableJson(snapshot: WidgetCalorieSnapshot): string {
  return JSON.stringify({
    schemaVersion: snapshot.schemaVersion,
    dateKey: snapshot.dateKey,
    remainingValue: snapshot.remainingValue,
    isOverGoal: snapshot.isOverGoal,
    labelRemaining: snapshot.labelRemaining,
    labelFooter: snapshot.labelFooter,
    labelFooterCompact: snapshot.labelFooterCompact,
    macros: snapshot.macros,
    premium: snapshot.premium,
    progress: snapshot.progress,
    koliVariant: snapshot.koliVariant,
  });
}

export function buildWidgetSnapshot(input: BuildWidgetSnapshotInput): WidgetCalorieSnapshot {
  const progress = clampProgress(input.progress);

  return {
    schemaVersion: WIDGET_CALORIE_SNAPSHOT_SCHEMA_VERSION,
    dateKey: input.dateKey,
    remainingValue: input.remainingValue,
    isOverGoal: input.isOverGoal,
    labelRemaining: input.labelRemaining,
    labelFooter: input.labelFooter,
    labelFooterCompact: input.labelFooterCompact,
    macros: input.macros,
    premium: input.premium,
    progress,
    koliVariant: resolveKoliVariant({
      isOverGoal: input.isOverGoal,
      progress,
    }),
    updatedAt: input.updatedAt ?? new Date().toISOString(),
  };
}

/**
 * Persists the snapshot into the App Group and reloads WidgetKit timelines.
 * Maps to WidgetCenter.reloadAllTimelines() when called without a kind.
 * Never throws — failures are reported to Sentry only.
 */
export function writeWidgetSnapshot(snapshot: WidgetCalorieSnapshot): void {
  if (Platform.OS !== 'ios') {
    return;
  }

  try {
    const storage = new ExtensionStorage(WIDGET_APP_GROUP);
    storage.set(WIDGET_CALORIE_SNAPSHOT_KEY, JSON.stringify(snapshot));
    ExtensionStorage.reloadWidget();
  } catch (error) {
    Sentry.captureException(error, { tags: { area: 'widget-snapshot' } });
  }
}
