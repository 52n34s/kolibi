import {
  isHealthDataAvailable,
  queryQuantitySamples,
  queryStatisticsForQuantity,
  queryWorkoutSamples,
  requestAuthorization,
  saveQuantitySample,
  WorkoutActivityType,
} from '@kingstinct/react-native-healthkit';
import * as Sentry from '@sentry/react-native';
import { Platform } from 'react-native';

import {
  normalizeHealthKitBodyFatPct,
  upsertBodyFatLog,
} from '@/lib/body-fat-logs';
import { createChunkedSecureStoreAdapter } from '@/lib/chunked-secure-store';
import { saveSportEnergyKcal } from '@/lib/daily-health-stats';
import {
  listRecentLocalDateKeys,
  localDateKey,
  localDayWindow,
  localMovementWindow,
  parseDateOnly,
} from '@/lib/day-window';
import type { MovementGoalPeriod, MovementGoalType } from '@/lib/profile';
import {
  MIN_SPORT_WORKOUT_DURATION_SECONDS,
  resolveSportIntensity,
} from '@/lib/sport-macro-scaling';
import {
  buildSportEnergyDay,
  hkWorkoutActivityI18nKey,
  type SportEnergyDay,
  type SportEnergyHkWorkoutInput,
  type SportEnergyTrainingSessionInput,
} from '@/lib/sport-energy-day';
import { mapTrainingIntensityToSportIntensity } from '@/lib/training-calories';
import type { TrainingActivity } from '@/lib/training-calories';
import { reconcileTrainingRows } from '@/lib/training-rows';
import { fetchTrainingSessionsForDate } from '@/lib/training-sessions';
import { supabase } from '@/lib/supabase';
import i18n from '@/i18n';
import { isUnitColorKey } from '@/lib/workouts/types';
import {
  getUserPreference,
  HEALTH_CONNECTED_PREFERENCE_KEY,
} from '@/lib/user-preferences';

/** One-time reauth after expanding HEALTH_READ_TYPES (steps / distance / workouts). */
export const HEALTH_READ_TYPES_V2_KEY = 'health_read_types_v2';
/** One-time reauth after adding heart rate for sport-intensity macros. */
export const HEALTH_READ_TYPES_V3_KEY = 'health_read_types_v3';
/** One-time reauth after adding waist circumference read/write access. */
export const HEALTH_READ_TYPES_V4_KEY = 'health_read_types_v4';
/** One-time reauth after adding body fat % and lean body mass read access. */
export const HEALTH_READ_TYPES_V5_KEY = 'health_read_types_v5';

const ACTIVE_ENERGY_TYPE = 'HKQuantityTypeIdentifierActiveEnergyBurned' as const;
const HEART_RATE_TYPE = 'HKQuantityTypeIdentifierHeartRate' as const;
const STEP_COUNT_TYPE = 'HKQuantityTypeIdentifierStepCount' as const;
const DISTANCE_WALKING_RUNNING_TYPE =
  'HKQuantityTypeIdentifierDistanceWalkingRunning' as const;
const WAIST_CIRCUMFERENCE_TYPE = 'HKQuantityTypeIdentifierWaistCircumference' as const;
const BODY_FAT_PERCENTAGE_TYPE = 'HKQuantityTypeIdentifierBodyFatPercentage' as const;
const LEAN_BODY_MASS_TYPE = 'HKQuantityTypeIdentifierLeanBodyMass' as const;
const WORKOUT_TYPE = 'HKWorkoutTypeIdentifier' as const;

const TRAINING_ACTIVITY_HK_TYPES: Record<
  TrainingActivity,
  readonly WorkoutActivityType[]
> = {
  strength: [
    WorkoutActivityType.traditionalStrengthTraining,
    WorkoutActivityType.functionalStrengthTraining,
  ],
  yoga: [WorkoutActivityType.yoga, WorkoutActivityType.pilates],
  swimming: [WorkoutActivityType.swimming],
  cycling: [WorkoutActivityType.cycling],
  other: [],
};

/** Types requested when the user connects Apple Health. */
const HEALTH_READ_TYPES = [
  ACTIVE_ENERGY_TYPE,
  HEART_RATE_TYPE,
  STEP_COUNT_TYPE,
  DISTANCE_WALKING_RUNNING_TYPE,
  WAIST_CIRCUMFERENCE_TYPE,
  BODY_FAT_PERCENTAGE_TYPE,
  LEAN_BODY_MASS_TYPE,
  WORKOUT_TYPE,
] as const;

/** Types Kolibi writes after a manual measurement. */
const HEALTH_WRITE_TYPES = [WAIST_CIRCUMFERENCE_TYPE] as const;

/** HKError.errorAuthorizationNotDetermined — expected before the user grants Health access. */
const HK_ERROR_AUTHORIZATION_NOT_DETERMINED = 5;

function isHealthAuthorizationNotDetermined(error: unknown): boolean {
  if (error == null) {
    return false;
  }

  const asText = typeof error === 'string' ? error : '';
  if (/authorization not determined/i.test(asText)) {
    return true;
  }

  if (typeof error !== 'object') {
    return false;
  }

  const record = error as {
    code?: unknown;
    message?: unknown;
    domain?: unknown;
    localizedDescription?: unknown;
    userInfo?: unknown;
    nativeStackIOS?: unknown;
  };

  const code = record.code;
  if (code === HK_ERROR_AUTHORIZATION_NOT_DETERMINED || code === '5') {
    return true;
  }

  const messageParts = [record.message, record.localizedDescription, record.domain]
    .filter((part): part is string => typeof part === 'string')
    .join(' ');

  if (/authorization not determined/i.test(messageParts)) {
    return true;
  }

  try {
    return /authorization not determined/i.test(JSON.stringify(error));
  } catch {
    return false;
  }
}

function quantityToKm(quantity: { unit: string; quantity: number } | undefined): number {
  if (quantity == null || !Number.isFinite(quantity.quantity)) {
    return 0;
  }

  const unit = quantity.unit.toLowerCase();
  if (unit === 'km' || unit === 'kilometer' || unit === 'kilometre') {
    return quantity.quantity;
  }
  if (unit === 'mi' || unit === 'mile') {
    return quantity.quantity * 1.609344;
  }
  // HealthKit defaults walking/running distance to meters.
  return quantity.quantity / 1000;
}

function roundKm(value: number): number {
  return Math.round(value * 10) / 10;
}

/**
 * Shows the system HealthKit authorization sheet for undetermined read types.
 * Always calls requestAuthorization so newly added types surface a sheet even
 * when older types were already authorized. iOS does not report whether read
 * access was denied — do not treat post-request status as a grant/deny signal.
 */
export async function requestHealthPermissions(): Promise<void> {
  if (Platform.OS !== 'ios' || !isHealthDataAvailable()) {
    return;
  }

  try {
    await requestAuthorization({
      toRead: [...HEALTH_READ_TYPES],
      toShare: [...HEALTH_WRITE_TYPES],
    });
  } catch (error) {
    console.error('[Health] permission request failed:', error);
  }
}

/**
 * Once per device after the read-types expansion: if Apple Health is already
 * connected, prompt for the new types. Never prompts again (flag set either way).
 * No success check — iOS read grants are not observable.
 */
export async function maybeUpgradeHealthReadTypesV2(userId: string): Promise<void> {
  if (Platform.OS !== 'ios') {
    return;
  }

  const secureStore = createChunkedSecureStoreAdapter();
  try {
    const alreadyDone = await secureStore.getItem(HEALTH_READ_TYPES_V2_KEY);
    if (alreadyDone != null) {
      return;
    }

    const connected = await getUserPreference(userId, HEALTH_CONNECTED_PREFERENCE_KEY);
    if (connected) {
      await requestHealthPermissions();
    }

    await secureStore.setItem(HEALTH_READ_TYPES_V2_KEY, '1');
  } catch (error) {
    console.error('[Health] read-types v2 upgrade failed:', error);
  }
}

/**
 * Once per device after heart-rate was added for intensity-aware sport macros.
 */
export async function maybeUpgradeHealthReadTypesV3(userId: string): Promise<void> {
  if (Platform.OS !== 'ios') {
    return;
  }

  const secureStore = createChunkedSecureStoreAdapter();
  try {
    const alreadyDone = await secureStore.getItem(HEALTH_READ_TYPES_V3_KEY);
    if (alreadyDone != null) {
      return;
    }

    const connected = await getUserPreference(userId, HEALTH_CONNECTED_PREFERENCE_KEY);
    if (connected) {
      await requestHealthPermissions();
    }

    await secureStore.setItem(HEALTH_READ_TYPES_V3_KEY, '1');
  } catch (error) {
    console.error('[Health] read-types v3 upgrade failed:', error);
  }
}

/**
 * Once per device after waist circumference was added as a HealthKit read/write type.
 */
export async function maybeUpgradeHealthReadTypesV4(userId: string): Promise<void> {
  if (Platform.OS !== 'ios') {
    return;
  }

  const secureStore = createChunkedSecureStoreAdapter();
  try {
    const alreadyDone = await secureStore.getItem(HEALTH_READ_TYPES_V4_KEY);
    if (alreadyDone != null) {
      return;
    }

    const connected = await getUserPreference(userId, HEALTH_CONNECTED_PREFERENCE_KEY);
    if (connected) {
      await requestHealthPermissions();
    }

    await secureStore.setItem(HEALTH_READ_TYPES_V4_KEY, '1');
  } catch (error) {
    console.error('[Health] read-types v4 upgrade failed:', error);
  }
}

/**
 * Once per device after body fat % / lean body mass were added as HealthKit read types.
 */
export async function maybeUpgradeHealthReadTypesV5(userId: string): Promise<void> {
  if (Platform.OS !== 'ios') {
    return;
  }

  const secureStore = createChunkedSecureStoreAdapter();
  try {
    const alreadyDone = await secureStore.getItem(HEALTH_READ_TYPES_V5_KEY);
    if (alreadyDone != null) {
      return;
    }

    const connected = await getUserPreference(userId, HEALTH_CONNECTED_PREFERENCE_KEY);
    if (connected) {
      await requestHealthPermissions();
    }

    await secureStore.setItem(HEALTH_READ_TYPES_V5_KEY, '1');
  } catch (error) {
    console.error('[Health] read-types v5 upgrade failed:', error);
  }
}

/** Saves a Kolibi waist measurement to Apple Health in meters. */
export async function saveWaistCircumferenceToHealth(
  waistCm: number,
  measuredAt: Date = new Date(),
): Promise<void> {
  if (Platform.OS !== 'ios' || !isHealthDataAvailable()) {
    return;
  }

  await saveQuantitySample(
    WAIST_CIRCUMFERENCE_TYPE,
    'm',
    waistCm / 100,
    measuredAt,
    measuredAt,
  );
}

/**
 * Best-effort read. Returns null when HealthKit is unavailable or the query fails.
 * @param dateKey — local `YYYY-MM-DD`; omit for today (endDate = now).
 */
export async function getActiveEnergyBurned(dateKey?: string): Promise<number | null> {
  if (Platform.OS !== 'ios' || !isHealthDataAvailable()) {
    return null;
  }

  try {
    let startISO: string;
    let endDate: Date;

    if (dateKey == null) {
      ({ startISO } = localDayWindow());
      endDate = new Date();
    } else {
      const day = parseDateOnly(dateKey);
      const window = localDayWindow(day);
      startISO = window.startISO;
      endDate = new Date(window.endISO);
    }

    const result = await queryStatisticsForQuantity(
      ACTIVE_ENERGY_TYPE,
      ['cumulativeSum'],
      {
        filter: {
          date: {
            startDate: new Date(startISO),
            endDate,
          },
        },
        unit: 'kcal',
      },
    );

    return result.sumQuantity?.quantity != null
      ? Math.round(result.sumQuantity.quantity)
      : null;
  } catch (error) {
    if (isHealthAuthorizationNotDetermined(error)) {
      // Callers only read when health_connected is true (Home query) or right
      // after setting it (Settings connect). Still notDetermined → silent Home hide.
      console.warn(
        '[Health] active energy read: authorization notDetermined while health_connected expected true',
        error,
      );
      Sentry.captureMessage(
        'HealthKit active energy: authorization notDetermined while health_connected',
        {
          level: 'warning',
          tags: { area: 'healthkit', auth: 'notDetermined' },
          extra: {
            health_connected: true,
            quantityType: ACTIVE_ENERGY_TYPE,
          },
        },
      );
      return null;
    }

    console.warn('[Health] read active energy failed:', error);
    throw error;
  }
}

function quantityDurationSeconds(duration: { unit: string; quantity: number } | undefined): number {
  if (duration == null || !Number.isFinite(duration.quantity)) {
    return 0;
  }
  const unit = duration.unit.toLowerCase();
  if (unit === 's' || unit === 'sec' || unit === 'second' || unit === 'seconds') {
    return duration.quantity;
  }
  if (unit === 'min' || unit === 'minute' || unit === 'minutes') {
    return duration.quantity * 60;
  }
  if (unit === 'hr' || unit === 'h' || unit === 'hour' || unit === 'hours') {
    return duration.quantity * 3600;
  }
  // HealthKit workout duration is typically seconds.
  return duration.quantity;
}

function quantityEnergyKcal(energy: { unit: string; quantity: number } | undefined): number | null {
  if (energy == null || !Number.isFinite(energy.quantity) || energy.quantity <= 0) {
    return null;
  }
  const unit = energy.unit.toLowerCase();
  if (unit === 'kcal' || unit === 'kilocalorie' || unit === 'kilocalories') {
    return energy.quantity;
  }
  if (unit === 'cal' || unit === 'calorie' || unit === 'calories') {
    return energy.quantity / 1000;
  }
  if (unit === 'kJ' || unit === 'kj' || unit === 'kilojoule' || unit === 'kilojoules') {
    return energy.quantity / 4.184;
  }
  // Default HealthKit energy for workouts is often kcal.
  return energy.quantity;
}

function heartRateToBpm(quantity: { unit: string; quantity: number } | undefined): number | null {
  if (quantity == null || !Number.isFinite(quantity.quantity) || quantity.quantity <= 0) {
    return null;
  }
  const unit = quantity.unit.toLowerCase();
  // count/s → bpm
  if (unit.includes('count/s') || unit === 'hz') {
    return quantity.quantity * 60;
  }
  return quantity.quantity;
}

export type { SportEnergyDay } from '@/lib/sport-energy-day';

/**
 * Intensity-aware sport energy for today's macro scaling and dynamic calorie burn.
 * Workouts are classified individually (HR → type → MODERATE).
 * Active Energy not covered by workouts is treated as LOW (everyday movement).
 * Manual training_sessions are added as an extra segment when
 * training_sessions_per_week is set and no matching HealthKit workout exists
 * for that session's activity (HealthKit wins). Clearing the weekly goal keeps
 * rows in training_sessions but excludes them here.
 * Watch-tracked AE during training without a matching workout sample is still
 * inside the residual — there is no subtractor.
 * Does not write historical calorie goals — display-time only.
 */
export async function getSportEnergyDay(params: {
  ageYears: number | null;
  dateKey?: string;
  userId?: string;
}): Promise<SportEnergyDay | null> {
  if (Platform.OS !== 'ios' || !isHealthDataAvailable()) {
    return null;
  }

  try {
    let startDate: Date;
    let endDate: Date;
    const dateKey = params.dateKey ?? localDateKey();

    if (params.dateKey == null) {
      const window = localDayWindow();
      startDate = new Date(window.startISO);
      endDate = new Date();
    } else {
      const day = parseDateOnly(params.dateKey);
      const window = localDayWindow(day);
      startDate = new Date(window.startISO);
      endDate = new Date(window.endISO);
    }

    const dateFilter = { startDate, endDate };

    const [activeEnergy, workouts] = await Promise.all([
      getActiveEnergyBurned(params.dateKey),
      queryWorkoutSamples({
        filter: { date: dateFilter },
        limit: -1,
      }),
    ]);

    if (activeEnergy == null) {
      return null;
    }

    const hkWorkouts: SportEnergyHkWorkoutInput[] = [];
    const hkActivityTypesPresent: number[] = [];

    for (const workout of workouts) {
      const activityType = Number(workout.workoutActivityType);
      hkActivityTypesPresent.push(activityType);

      const durationSec = quantityDurationSeconds(workout.duration);
      if (durationSec < MIN_SPORT_WORKOUT_DURATION_SECONDS) {
        continue;
      }

      const kcal = quantityEnergyKcal(workout.totalEnergyBurned);
      if (kcal == null) {
        continue;
      }

      let averageHrBpm: number | null = null;
      try {
        const hrStats = await workout.getStatistic(HEART_RATE_TYPE, 'count/min');
        averageHrBpm = heartRateToBpm(hrStats?.averageQuantity);
      } catch {
        averageHrBpm = null;
      }

      const intensity = resolveSportIntensity({
        averageHrBpm,
        ageYears: params.ageYears,
        activityType,
      });

      const roundedKcal = Math.round(kcal);
      if (roundedKcal <= 0) {
        continue;
      }

      hkWorkouts.push({
        activityType,
        kcal: roundedKcal,
        intensity,
        label: i18n.t(hkWorkoutActivityI18nKey(activityType)),
      });
    }

    let sessionsPerWeek: number | null = null;
    const trainingInputs: SportEnergyTrainingSessionInput[] = [];

    if (params.userId) {
      try {
        const { data: trainingProfile, error: trainingProfileError } = await supabase
          .from('profiles')
          .select('training_sessions_per_week')
          .eq('id', params.userId)
          .maybeSingle();

        if (trainingProfileError) {
          throw trainingProfileError;
        }

        sessionsPerWeek =
          trainingProfile?.training_sessions_per_week == null
            ? null
            : Number(trainingProfile.training_sessions_per_week);

        if (sessionsPerWeek != null && Number.isFinite(sessionsPerWeek) && sessionsPerWeek >= 1) {
          const trainingSessions = await fetchTrainingSessionsForDate(params.userId, dateKey);
          let unitByTrainingSessionId = new Map<
            string,
            { name: string; shortLabel: string; colorKey: string }
          >();
          let dayUnits: Awaited<ReturnType<typeof fetchWorkoutUnitsForDay>>['units'] = [];
          try {
            const day = await fetchWorkoutUnitsForDay(params.userId, dateKey);
            unitByTrainingSessionId = day.labels;
            dayUnits = day.units;
          } catch (unitLabelError) {
            console.warn(
              '[Health] workout unit labels for sport energy failed:',
              unitLabelError,
            );
          }

          // Unlinked duplicates of a unit never count on top (nor next to Health).
          for (const trainingSession of reconcileTrainingRows(trainingSessions, dayUnits).kept) {
            const unit = unitByTrainingSessionId.get(trainingSession.id);
            trainingInputs.push({
              activity: trainingSession.activity,
              kcal: trainingSession.kcal,
              intensity: mapTrainingIntensityToSportIntensity(trainingSession.intensity),
              label: unit?.name ?? i18n.t(`home.training.activity.${trainingSession.activity}`),
              ...(unit?.shortLabel != null ? { shortLabel: unit.shortLabel } : {}),
              ...(unit?.colorKey != null ? { colorKey: unit.colorKey } : {}),
            });
          }
        }
      } catch (trainingError) {
        console.warn('[Health] training session load for sport energy failed:', trainingError);
      }
    }

    const day = buildSportEnergyDay({
      activeEnergyKcal: activeEnergy,
      workouts: hkWorkouts,
      hkActivityTypesPresent,
      trainingSessions: trainingInputs,
      sessionsPerWeek,
      baselineLabel: i18n.t('home.calorieGoal.sportBreakdown.baseline'),
    });

    if (params.userId) {
      // History reads this instead of guessing the day from Active Energy.
      void saveSportEnergyKcal({
        userId: params.userId,
        dateKey,
        sportEnergyKcal: day.totalActiveKcal,
      });
    }

    return day;
  } catch (error) {
    if (isHealthAuthorizationNotDetermined(error)) {
      console.warn(
        '[Health] sport energy day: authorization notDetermined while health_connected expected true',
        error,
      );
      return null;
    }

    console.warn('[Health] read sport energy day failed:', error);
    return null;
  }
}

async function fetchWorkoutUnitsForDay(
  userId: string,
  loggedOn: string,
): Promise<{
  labels: Map<string, { name: string; shortLabel: string; colorKey: string }>;
  units: { loggedOn: string; finishedAt: string | null; trainingSessionId: string | null }[];
}> {
  const map = new Map<string, { name: string; shortLabel: string; colorKey: string }>();
  const { data, error } = await supabase
    .from('workout_sessions')
    .select('training_session_id, template_name, short_label, color_key, finished_at')
    .eq('user_id', userId)
    .eq('logged_on', loggedOn);

  if (error) {
    throw error;
  }

  const units = (data ?? []).map((row) => ({
    loggedOn,
    finishedAt: typeof row.finished_at === 'string' ? row.finished_at : null,
    trainingSessionId:
      typeof row.training_session_id === 'string' ? row.training_session_id : null,
  }));

  for (const row of data ?? []) {
    const trainingSessionId =
      typeof row.training_session_id === 'string' ? row.training_session_id : null;
    if (trainingSessionId == null || map.has(trainingSessionId)) {
      continue;
    }
    const colorKey =
      typeof row.color_key === 'string' && isUnitColorKey(row.color_key)
        ? row.color_key
        : 'indigo';
    map.set(trainingSessionId, {
      name: typeof row.template_name === 'string' ? row.template_name : '',
      shortLabel: typeof row.short_label === 'string' ? row.short_label : '',
      colorKey,
    });
  }

  return { labels: map, units };
}

/**
 * Live movement progress from HealthKit for the user's goal type/period.
 * Display-only — does not write to the database or affect calorie goals.
 *
 * Progress Laufkilometer uses this current window only (same as Home).
 * Open: a 7/30 daily series would need either 30 HealthKit queries or
 * persisting daily running km in `daily_health_stats`. Neither is in place.
 */
export async function getMovementActual(params: {
  type: MovementGoalType;
  period: MovementGoalPeriod;
}): Promise<number | null> {
  if (Platform.OS !== 'ios' || !isHealthDataAvailable()) {
    return null;
  }

  const { start, end } = localMovementWindow(params.period);
  const dateFilter = {
    startDate: start,
    endDate: end,
  };

  try {
    if (params.type === 'steps') {
      const result = await queryStatisticsForQuantity(
        STEP_COUNT_TYPE,
        ['cumulativeSum'],
        {
          filter: { date: dateFilter },
          unit: 'count',
        },
      );
      const quantity = result.sumQuantity?.quantity;
      return quantity != null && Number.isFinite(quantity) ? Math.round(quantity) : 0;
    }

    if (params.type === 'distance_km') {
      const result = await queryStatisticsForQuantity(
        DISTANCE_WALKING_RUNNING_TYPE,
        ['cumulativeSum'],
        {
          filter: { date: dateFilter },
          unit: 'km',
        },
      );
      if (result.sumQuantity != null) {
        return roundKm(quantityToKm(result.sumQuantity));
      }
      return 0;
    }

    // running_km — only recorded running workouts
    const workouts = await queryWorkoutSamples({
      filter: {
        workoutActivityType: WorkoutActivityType.running,
        date: dateFilter,
      },
      limit: -1,
    });

    let totalKm = 0;
    for (const workout of workouts) {
      totalKm += quantityToKm(workout.totalDistance);
    }
    return roundKm(totalKm);
  } catch (error) {
    if (isHealthAuthorizationNotDetermined(error)) {
      console.warn(
        '[Health] movement read: authorization notDetermined while health_connected expected true',
        error,
      );
      return null;
    }

    console.warn('[Health] read movement actual failed:', error);
    return null;
  }
}

/**
 * True when HealthKit already has a workout matching the selected training
 * activity on the local calendar day — blocks a manual training_sessions entry.
 * Returns null when Health is unavailable / not authorized / non-iOS.
 * `other` never blocks (no HealthKit types mapped).
 */
export async function hasMatchingTrainingWorkoutOnDate(
  dateKey: string,
  activity: TrainingActivity,
): Promise<boolean | null> {
  if (Platform.OS !== 'ios' || !isHealthDataAvailable()) {
    return null;
  }

  const types = TRAINING_ACTIVITY_HK_TYPES[activity];
  if (types.length === 0) {
    return false;
  }

  try {
    const day = parseDateOnly(dateKey);
    const window = localDayWindow(day);
    const dateFilter = {
      startDate: new Date(window.startISO),
      endDate: new Date(window.endISO),
    };

    const results = await Promise.all(
      types.map((workoutActivityType) =>
        queryWorkoutSamples({
          filter: {
            workoutActivityType,
            date: dateFilter,
          },
          limit: 1,
        }),
      ),
    );

    return results.some((samples) => (samples?.length ?? 0) > 0);
  } catch (error) {
    if (isHealthAuthorizationNotDetermined(error)) {
      console.warn(
        '[Health] training workout check: authorization notDetermined',
        error,
      );
      return null;
    }

    console.warn('[Health] training workout check failed:', error);
    return null;
  }
}

const BODY_FAT_SYNC_LOOKBACK_DAYS = 90;

/**
 * Imports body-fat % samples from HealthKit, keeping one bioimpedance source.
 * Anchor: latest stored healthkit `source_bundle`, else the newest sample's source.
 */
export async function syncBodyFatFromHealth(userId: string): Promise<void> {
  if (Platform.OS !== 'ios' || !isHealthDataAvailable()) {
    return;
  }

  try {
    const since = new Date();
    since.setHours(0, 0, 0, 0);
    since.setDate(since.getDate() - (BODY_FAT_SYNC_LOOKBACK_DAYS - 1));

    const samples = await queryQuantitySamples(BODY_FAT_PERCENTAGE_TYPE, {
      limit: 0,
      ascending: false,
      unit: '%',
      filter: {
        date: {
          startDate: since,
          endDate: new Date(),
        },
      },
    });

    if (samples.length === 0) {
      return;
    }

    const sinceKey = localDateKey(since);
    const { data: existingRows, error: existingError } = await supabase
      .from('body_fat_logs')
      .select('logged_on, source, source_bundle')
      .eq('user_id', userId)
      .gte('logged_on', sinceKey)
      .order('logged_on', { ascending: false });

    if (existingError) {
      throw existingError;
    }

    const manualDays = new Set(
      (existingRows ?? [])
        .filter((row) => row.source === 'manual')
        .map((row) => String(row.logged_on)),
    );

    const preferredBundleFromStore = (existingRows ?? []).find(
      (row) => row.source === 'healthkit' && row.source_bundle,
    )?.source_bundle;
    const preferredBundle =
      (typeof preferredBundleFromStore === 'string' && preferredBundleFromStore.length > 0
        ? preferredBundleFromStore
        : null) ??
      (samples[0]?.sourceRevision?.source?.bundleIdentifier ?? null);

    if (preferredBundle == null || preferredBundle.length === 0) {
      return;
    }

    /** One sample per local day (newest wins; samples are newest-first). */
    const byDay = new Map<
      string,
      { bodyFatPct: number; loggedAt: Date; sourceBundle: string }
    >();

    for (const sample of samples) {
      const bundle = sample.sourceRevision?.source?.bundleIdentifier;
      if (bundle !== preferredBundle) {
        continue;
      }
      const bodyFatPct = normalizeHealthKitBodyFatPct(sample.quantity);
      if (bodyFatPct == null) {
        continue;
      }
      const loggedAt = sample.endDate ?? sample.startDate;
      const dayKey = localDateKey(loggedAt);
      if (byDay.has(dayKey)) {
        continue;
      }
      byDay.set(dayKey, { bodyFatPct, loggedAt, sourceBundle: preferredBundle });
    }

    for (const [loggedOn, entry] of Array.from(byDay.entries())) {
      if (manualDays.has(loggedOn)) {
        continue;
      }
      await upsertBodyFatLog({
        userId,
        bodyFatPct: entry.bodyFatPct,
        loggedOn,
        source: 'healthkit',
        sourceBundle: entry.sourceBundle,
      });
    }
  } catch (error) {
    if (isHealthAuthorizationNotDetermined(error)) {
      console.warn('[Health] body-fat sync: authorization notDetermined');
      return;
    }
    Sentry.captureException(error, { tags: { flow: 'health-body-fat-sync' } });
    console.error('[Health] body-fat sync failed:', error);
  }
}

/**
 * Pulls HealthKit active energy for recent local days into daily_health_stats.
 * Fire-and-forget at app start when health_connected is true.
 */
export async function syncHealthStatsForRecentDays(
  userId: string,
  days = 7,
): Promise<void> {
  const connected = await getUserPreference(userId, HEALTH_CONNECTED_PREFERENCE_KEY);
  if (!connected) {
    return;
  }

  void syncBodyFatFromHealth(userId);

  const dateKeys = listRecentLocalDateKeys(days);
  const todayKey = localDateKey();

  const { data: existingRows, error: existingError } = await supabase
    .from('daily_health_stats')
    .select('day')
    .eq('user_id', userId)
    .in('day', dateKeys);

  if (existingError) {
    Sentry.captureException(existingError, { tags: { flow: 'health-sync' } });
    console.error('[Health] daily_health_stats select failed:', existingError);
    return;
  }

  const existingDays = new Set(
    (existingRows ?? []).map((row) => String(row.day)),
  );

  for (const dateKey of dateKeys) {
    try {
      const burned = await getActiveEnergyBurned(dateKey);
      if (burned == null) {
        continue;
      }

      const isToday = dateKey === todayKey;
      const exists = existingDays.has(dateKey);
      const updatedAt = new Date().toISOString();

      if (isToday) {
        const { error } = await supabase.from('daily_health_stats').upsert(
          {
            user_id: userId,
            day: dateKey,
            active_energy_kcal: burned,
            health_connected: true,
            backfilled: false,
            updated_at: updatedAt,
          },
          { onConflict: 'user_id,day' },
        );

        if (error) {
          throw error;
        }
        continue;
      }

      if (exists) {
        const { error } = await supabase
          .from('daily_health_stats')
          .update({
            active_energy_kcal: burned,
            updated_at: updatedAt,
          })
          .eq('user_id', userId)
          .eq('day', dateKey);

        if (error) {
          throw error;
        }
      } else {
        const { error } = await supabase.from('daily_health_stats').insert({
          user_id: userId,
          day: dateKey,
          active_energy_kcal: burned,
          health_connected: true,
          backfilled: true,
          updated_at: updatedAt,
        });

        if (error) {
          throw error;
        }

        existingDays.add(dateKey);
      }
    } catch (error) {
      Sentry.captureException(error, { tags: { flow: 'health-sync' } });
      console.error('[Health] sync day failed:', dateKey, error);
    }
  }
}
