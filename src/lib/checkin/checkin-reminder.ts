import i18n from '@/i18n';

import { parseReminderTime } from '@/lib/checkin/checkin-status';
import { cancelLocal, scheduleLocalDaily } from '@/lib/notifications-local';

/** Fixed id: rescheduling replaces, cancelling needs no stored id. */
export const CHECKIN_REMINDER_ID = 'checkin-reminder';

/**
 * Daily local reminder at wake-up time. Scheduled when the check-in is on and
 * a time is set, cancelled otherwise. Safe to call on every app start.
 */
export async function syncCheckinReminder(params: {
  available: boolean;
  enabled: boolean;
  reminderTime: string | null;
}): Promise<void> {
  const time = parseReminderTime(params.reminderTime);
  if (!params.available || !params.enabled || time == null) {
    await cancelLocal(CHECKIN_REMINDER_ID);
    return;
  }
  await scheduleLocalDaily(
    CHECKIN_REMINDER_ID,
    time,
    {
      title: i18n.t('checkin.reminder.title'),
      body: i18n.t('checkin.reminder.body'),
    },
    { kind: 'checkin', url: '/home' },
  );
}
