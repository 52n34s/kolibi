import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text } from 'react-native';

import { sessionElapsedLabel } from '@/components/training/training-panel-utils';
import { getGlassCardStyle } from '@/components/ui/glass-styles';
import { BRAND_INDIGO } from '@/constants/brand';
import { useTimerTick } from '@/hooks/use-timer-tick';
import { formatTimerMmSs, remainingMs } from '@/lib/training/rest-timer';
import { useRestTimerStore } from '@/stores/rest-timer-store';
import { useWorkoutSessionStore } from '@/stores/workout-session-store';

type HomeActiveSessionBarProps = {
  onPress: () => void;
};

export function HomeActiveSessionBar({ onPress }: HomeActiveSessionBarProps) {
  const { t } = useTranslation();
  const active = useWorkoutSessionStore((s) => s.active);
  const restStatus = useRestTimerStore((s) => s.status);
  const endsAt = useRestTimerStore((s) => s.endsAt);
  const remainingOnPause = useRestTimerStore((s) => s.remainingOnPause);
  const markFinishedIfDue = useRestTimerStore((s) => s.markFinishedIfDue);

  const restTicking = restStatus === 'running';
  const now = useTimerTick(Boolean(active) || restTicking);

  useEffect(() => {
    if (restStatus === 'running') {
      markFinishedIfDue(now);
    }
  }, [markFinishedIfDue, now, restStatus]);

  if (!active) {
    return null;
  }

  const restActive =
    restStatus === 'running' || restStatus === 'paused' || restStatus === 'finished';
  const timeLabel = restActive
    ? restStatus === 'finished'
      ? t('training.timer.goAhead')
      : formatTimerMmSs(remainingMs({ status: restStatus, endsAt, remainingOnPause }, now))
    : sessionElapsedLabel(active.startedAt, now);

  return (
    <Pressable
      testID="home.activeSessionBar"
      accessibilityRole="button"
      onPress={onPress}
      style={styles.bar}>
      <Text style={styles.text} numberOfLines={1}>
        {t('home.activeSessionBar.label', {
          shortLabel: active.shortLabel,
          time: timeLabel,
        })}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  bar: {
    ...getGlassCardStyle({
      borderRadius: 12,
      paddingHorizontal: 14,
      paddingVertical: 8,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'rgba(255, 255, 255, 0.28)',
    }),
  },
  text: {
    fontSize: 13,
    fontWeight: '600',
    color: BRAND_INDIGO,
    textAlign: 'center',
  },
});
