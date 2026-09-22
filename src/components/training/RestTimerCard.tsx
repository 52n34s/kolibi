import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { GlassCard } from '@/components/ui/glass-card';
import { BRAND_INDIGO, TEXT_SECONDARY } from '@/constants/brand';
import { useTimerTick } from '@/hooks/use-timer-tick';
import { formatTimerMmSs, remainingMs } from '@/lib/training/rest-timer';
import { useRestTimerStore } from '@/stores/rest-timer-store';

export function RestTimerCard() {
  const { t } = useTranslation();
  const status = useRestTimerStore((s) => s.status);
  const endsAt = useRestTimerStore((s) => s.endsAt);
  const remainingOnPause = useRestTimerStore((s) => s.remainingOnPause);
  const idleDurationSec = useRestTimerStore((s) => s.idleDurationSec);
  const start = useRestTimerStore((s) => s.start);
  const pause = useRestTimerStore((s) => s.pause);
  const resume = useRestTimerStore((s) => s.resume);
  const stop = useRestTimerStore((s) => s.stop);
  const addSeconds = useRestTimerStore((s) => s.addSeconds);
  const markFinishedIfDue = useRestTimerStore((s) => s.markFinishedIfDue);
  const acknowledgeFinished = useRestTimerStore((s) => s.acknowledgeFinished);

  const ticking = status === 'running';
  const now = useTimerTick(ticking);

  useEffect(() => {
    if (status === 'running') {
      markFinishedIfDue(now);
    }
  }, [markFinishedIfDue, now, status]);

  const displayMs =
    status === 'idle' || status === 'finished'
      ? idleDurationSec * 1000
      : remainingMs({ status, endsAt, remainingOnPause }, now);

  const timeLabel =
    status === 'finished' ? t('training.timer.goAhead') : formatTimerMmSs(displayMs);

  return (
    <GlassCard style={styles.card}>
      <Text
        testID="training.timerCard.time"
        style={[styles.time, status === 'finished' && styles.finished]}>
        {timeLabel}
      </Text>

      <View style={styles.row}>
        <Pressable
          testID="training.timerCard.minus30"
          accessibilityRole="button"
          onPress={() => void addSeconds(-30)}
          style={styles.chip}>
          <Text style={styles.chipText}>−30</Text>
        </Pressable>
        <Pressable
          testID="training.timerCard.plus30"
          accessibilityRole="button"
          onPress={() => void addSeconds(30)}
          style={styles.chip}>
          <Text style={styles.chipText}>+30</Text>
        </Pressable>
      </View>

      <View style={styles.row}>
        {status === 'idle' || status === 'finished' ? (
          <Pressable
            testID="training.timerCard.start"
            accessibilityRole="button"
            onPress={() => {
              if (status === 'finished') {
                acknowledgeFinished();
              }
              void start();
            }}
            style={styles.primary}>
            <Text style={styles.primaryText}>{t('training.timer.start')}</Text>
          </Pressable>
        ) : null}

        {status === 'running' ? (
          <Pressable
            testID="training.timerCard.pause"
            accessibilityRole="button"
            onPress={() => void pause()}
            style={styles.primary}>
            <Text style={styles.primaryText}>{t('training.timer.pause')}</Text>
          </Pressable>
        ) : null}

        {status === 'paused' ? (
          <Pressable
            testID="training.timerCard.resume"
            accessibilityRole="button"
            onPress={() => void resume()}
            style={styles.primary}>
            <Text style={styles.primaryText}>{t('training.timer.resume')}</Text>
          </Pressable>
        ) : null}

        {status === 'running' || status === 'paused' ? (
          <Pressable
            testID="training.timerCard.stop"
            accessibilityRole="button"
            onPress={() => void stop()}
            style={styles.secondary}>
            <Text style={styles.secondaryText}>{t('training.timer.stop')}</Text>
          </Pressable>
        ) : null}
      </View>
    </GlassCard>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: 20,
    gap: 16,
  },
  time: {
    fontSize: 48,
    fontWeight: '600',
    color: BRAND_INDIGO,
    textAlign: 'center',
    fontVariant: ['tabular-nums'],
  },
  finished: {
    fontSize: 28,
    color: TEXT_SECONDARY,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 12,
    flexWrap: 'wrap',
  },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: 'rgba(79, 70, 229, 0.1)',
  },
  chipText: {
    color: BRAND_INDIGO,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  primary: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 999,
    backgroundColor: BRAND_INDIGO,
  },
  primaryText: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  secondary: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 999,
    backgroundColor: 'rgba(79, 70, 229, 0.12)',
  },
  secondaryText: {
    color: TEXT_SECONDARY,
    fontWeight: '600',
  },
});
