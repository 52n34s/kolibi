import * as Notifications from 'expo-notifications';
import * as Sentry from '@sentry/react-native';

export type LocalNotificationContent = {
  title?: string;
  body: string;
};

export type LocalNotificationData = Record<string, unknown>;

/**
 * Schedule a one-shot local notification at an absolute date (DATE trigger).
 * Returns the notification identifier, or null when scheduling fails.
 */
export async function scheduleLocalAt(
  date: Date,
  content: LocalNotificationContent,
  data: LocalNotificationData = {},
): Promise<string | null> {
  try {
    if (!(date.getTime() > Date.now())) {
      return null;
    }
    const id = await Notifications.scheduleNotificationAsync({
      content: {
        title: content.title,
        body: content.body,
        data,
        sound: false,
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date,
      },
    });
    return id;
  } catch (error) {
    Sentry.captureException(error);
    return null;
  }
}

/**
 * Schedule a local notification repeating every day at hour:minute (DAILY
 * trigger) under a fixed identifier, replacing an earlier one with that id.
 * Returns the identifier, or null when scheduling fails.
 */
export async function scheduleLocalDaily(
  identifier: string,
  time: { hour: number; minute: number },
  content: LocalNotificationContent,
  data: LocalNotificationData = {},
): Promise<string | null> {
  try {
    await cancelLocal(identifier);
    return await Notifications.scheduleNotificationAsync({
      identifier,
      content: {
        title: content.title,
        body: content.body,
        data,
        sound: false,
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DAILY,
        hour: time.hour,
        minute: time.minute,
      },
    });
  } catch (error) {
    Sentry.captureException(error);
    return null;
  }
}

export async function cancelLocal(id: string | null | undefined): Promise<void> {
  if (!id) {
    return;
  }
  try {
    await Notifications.cancelScheduledNotificationAsync(id);
  } catch (error) {
    Sentry.captureException(error);
  }
}

/** Request notification permission when still undetermined (no pre-prompt UI). */
export async function ensureLocalNotificationPermission(): Promise<void> {
  try {
    const current = await Notifications.getPermissionsAsync();
    if (current.status === 'undetermined') {
      await Notifications.requestPermissionsAsync();
    }
  } catch (error) {
    Sentry.captureException(error);
  }
}
