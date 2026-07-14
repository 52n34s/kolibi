import {
  AuthorizationRequestStatus,
  getRequestStatusForAuthorization,
  isHealthDataAvailable,
  queryStatisticsForQuantity,
  requestAuthorization,
} from '@kingstinct/react-native-healthkit';
import { Platform } from 'react-native';

import { localDayWindow } from '@/lib/day-window';

const ACTIVE_ENERGY_TYPE = 'HKQuantityTypeIdentifierActiveEnergyBurned' as const;

export async function requestHealthPermissions(): Promise<boolean> {
  if (Platform.OS !== 'ios' || !isHealthDataAvailable()) {
    return false;
  }

  try {
    const requestStatus = await getRequestStatusForAuthorization({
      toRead: [ACTIVE_ENERGY_TYPE],
    });

    if (requestStatus === AuthorizationRequestStatus.shouldRequest) {
      await requestAuthorization({ toRead: [ACTIVE_ENERGY_TYPE] });
    }

    const postRequestStatus = await getRequestStatusForAuthorization({
      toRead: [ACTIVE_ENERGY_TYPE],
    });

    return postRequestStatus !== AuthorizationRequestStatus.shouldRequest;
  } catch (error) {
    console.error('[Health] permission request failed:', error);
    return false;
  }
}

export async function isHealthConnected(): Promise<boolean> {
  if (Platform.OS !== 'ios' || !isHealthDataAvailable()) {
    return false;
  }

  try {
    const status = await getRequestStatusForAuthorization({
      toRead: [ACTIVE_ENERGY_TYPE],
    });

    return status !== AuthorizationRequestStatus.shouldRequest;
  } catch {
    return false;
  }
}

export async function getActiveEnergyBurnedToday(): Promise<number | null> {
  if (Platform.OS !== 'ios' || !isHealthDataAvailable()) {
    return null;
  }

  if (!(await isHealthConnected())) {
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

    return Math.round(result.sumQuantity?.quantity ?? 0);
  } catch (error) {
    console.error('[Health] read active energy failed:', error);
    return null;
  }
}
