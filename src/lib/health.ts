import {
  isHealthDataAvailable,
  queryStatisticsForQuantity,
  queryWorkoutSamples,
  requestAuthorization,
  WorkoutActivityType,
} from '@kingstinct/react-native-healthkit';
import * as Sentry from '@sentry/react-native';
import { Platform } from 'react-native';

import { createChunkedSecureStoreAdapter } from '@/lib/chunked-secure-store';
import {
  listRecentLocalDateKeys,
  localDateKey,
  localDayWindow,
  localMovementWindow,
  parseDateOnly,
} from '@/lib/day-window';
import type { MovementGoalPeriod, MovementGoalType } from '@/lib/profile';
import { supabase } from '@/lib/supabase';
import {
  getUserPreference,
  HEALTH_CONNECTED_PREFERENCE_KEY,
} from '@/lib/user-preferences';

/** One-time reauth after expanding HEALTH_READ_TYPES (steps / distance / workouts). */
export const HEALTH_READ_TYPES_V2_KEY = 'health_read_types_v2';

const ACTIVE_ENERGY_TYPE = 'HKQuantityTypeIdentifierActiveEnergyBurned' as const;
const STEP_COUNT_TYPE = 'HKQuantityTypeIdentifierStepCount' as const;
const DISTANCE_WALKING_RUNNING_TYPE =
  'HKQuantityTypeIdentifierDistanceWalkingRunning' as const;
const WORKOUT_TYPE = 'HKWorkoutTypeIdentifier' as const;

/** Types requested when the user connects Apple Health. */
const HEALTH_READ_TYPES = [
  ACTIVE_ENERGY_TYPE,
  STEP_COUNT_TYPE,
  DISTANCE_WALKING_RUNNING_TYPE,
  WORKOUT_TYPE,
] as const;

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
    await requestAuthorization({ toRead: [...HEALTH_READ_TYPES] });
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

/**
 * Live movement progress from HealthKit for the user's goal type/period.
 * Display-only — does not write to the database or affect calorie goals.
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
