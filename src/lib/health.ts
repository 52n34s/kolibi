import {
  AuthorizationRequestStatus,
  getRequestStatusForAuthorization,
  isHealthDataAvailable,
  queryStatisticsForQuantity,
  requestAuthorization,
} from '@kingstinct/react-native-healthkit';
import * as Sentry from '@sentry/react-native';
import { Platform } from 'react-native';

import { listRecentLocalDateKeys, localDateKey, localDayWindow, parseDateOnly } from '@/lib/day-window';
import { supabase } from '@/lib/supabase';
import {
  getUserPreference,
  HEALTH_CONNECTED_PREFERENCE_KEY,
} from '@/lib/user-preferences';

const ACTIVE_ENERGY_TYPE = 'HKQuantityTypeIdentifierActiveEnergyBurned' as const;

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

/**
 * Shows the system HealthKit authorization sheet when needed.
 * iOS does not report whether read access was denied — do not treat the
 * post-request status as a grant/deny signal.
 */
export async function requestHealthPermissions(): Promise<void> {
  if (Platform.OS !== 'ios' || !isHealthDataAvailable()) {
    return;
  }

  try {
    const requestStatus = await getRequestStatusForAuthorization({
      toRead: [ACTIVE_ENERGY_TYPE],
    });

    if (requestStatus === AuthorizationRequestStatus.shouldRequest) {
      await requestAuthorization({ toRead: [ACTIVE_ENERGY_TYPE] });
    }
  } catch (error) {
    console.error('[Health] permission request failed:', error);
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
