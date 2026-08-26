import {
  AuthorizationRequestStatus,
  getRequestStatusForAuthorization,
  isHealthDataAvailable,
  queryStatisticsForQuantity,
  requestAuthorization,
} from '@kingstinct/react-native-healthkit';
import * as Sentry from '@sentry/react-native';
import { Platform } from 'react-native';

import { localDayWindow } from '@/lib/day-window';

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

/** Best-effort read. Returns null when HealthKit is unavailable or the query fails. */
export async function getActiveEnergyBurnedToday(): Promise<number | null> {
  if (Platform.OS !== 'ios' || !isHealthDataAvailable()) {
    return null;
  }

  try {
    const { startISO } = localDayWindow();

    const result = await queryStatisticsForQuantity(
      ACTIVE_ENERGY_TYPE,
      ['cumulativeSum'],
      {
        filter: {
          date: {
            startDate: new Date(startISO),
            endDate: new Date(),
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
