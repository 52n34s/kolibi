import * as Sentry from '@sentry/react-native';
import { ExtensionStorage } from '@bacons/apple-targets';
import { Platform } from 'react-native';

export type WidgetMacroSnapshot = {
  label: string;
  value: string;
};

export type WidgetCalorieSnapshot = {
  schemaVersion: number;
  dateKey: string;
  remainingValue: string;
  isOverGoal: boolean;
  labelRemaining: string;
  labelFooter: string;
  macros: WidgetMacroSnapshot[];
  premium: boolean;
  progress: number;
  updatedAt: string;
};

export const WIDGET_APP_GROUP = 'group.com.steffen.kolibi';
export const WIDGET_CALORIE_SNAPSHOT_KEY = 'calorieSnapshot';
export const WIDGET_CALORIE_SNAPSHOT_SCHEMA_VERSION = 1;

export type BuildWidgetSnapshotInput = {
  dateKey: string;
  remainingValue: string;
  isOverGoal: boolean;
  labelRemaining: string;
  labelFooter: string;
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

/** Comparable payload for write-deduping (excludes updatedAt). */
export function widgetSnapshotComparableJson(snapshot: WidgetCalorieSnapshot): string {
  return JSON.stringify({
    schemaVersion: snapshot.schemaVersion,
    dateKey: snapshot.dateKey,
    remainingValue: snapshot.remainingValue,
    isOverGoal: snapshot.isOverGoal,
    labelRemaining: snapshot.labelRemaining,
    labelFooter: snapshot.labelFooter,
    macros: snapshot.macros,
    premium: snapshot.premium,
    progress: snapshot.progress,
  });
}

export function buildWidgetSnapshot(input: BuildWidgetSnapshotInput): WidgetCalorieSnapshot {
  return {
    schemaVersion: WIDGET_CALORIE_SNAPSHOT_SCHEMA_VERSION,
    dateKey: input.dateKey,
    remainingValue: input.remainingValue,
    isOverGoal: input.isOverGoal,
    labelRemaining: input.labelRemaining,
    labelFooter: input.labelFooter,
    macros: input.macros,
    premium: input.premium,
    progress: clampProgress(input.progress),
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
