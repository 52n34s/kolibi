import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { GlassCard } from '@/components/ui/glass-card';
import { BRAND_INDIGO, BRAND_MINT, TEXT_SECONDARY } from '@/constants/brand';
import { useTimerTick } from '@/hooks/use-timer-tick';
import {
  formatTimerMmSs,
  remainingMs,
  restProgress,
} from '@/lib/training/rest-timer';
import { useRestTimerStore } from '@/stores/rest-timer-store';

export function RestTimerBar() {
  const { t } = useTranslation();
  const status = useRestTimerStore((s) => s.status);
  const endsAt = useRestTimerStore((s) => s.endsAt);
  const remainingOnPause = useRestTimerStore((s) => s.remainingOnPause);
  const durationSec = useRestTimerStore((s) => s.durationSec);
  const pause = useRestTimerStore((s) => s.pause);
  const resume = useRestTimerStore((s) => s.resume);
  const skip = useRestTimerStore((s) => s.skip);
  const addSeconds = useRestTimerStore((s) => s.addSeconds);
  const markFinishedIfDue = useRestTimerStore((s) => s.markFinishedIfDue);
  const acknowledgeFinished = useRestTimerStore((s) => s.acknowledgeFinished);

  const active = status === 'running' || status === 'paused' || status === 'finished';
  const ticking = status === 'running';
  const now = useTimerTick(ticking);

  useEffect(() => {
    if (status === 'running') {
      markFinishedIfDue(now);
    }
  }, [markFinishedIfDue, now, status]);

  if (!active) {
    return null;
  }

  const left = remainingMs({ status, endsAt, remainingOnPause }, now);
  const progress =
    status === 'finished'
      ? 1
      : restProgress({ status, endsAt, remainingOnPause, durationSec }, now);

  const timeLabel =
    status === 'finished' ? t('training.timer.goAhead') : formatTimerMmSs(left);

  return (
    <View style={styles.wrap}>
      <GlassCard style={styles.card}>
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { flex: Math.max(0.0001, progress) }]} />
          <View style={{ flex: Math.max(0.0001, 1 - progress) }} />
        </View>

        <View style={styles.row}>
          <Text
            testID="training.timerBar.time"
            style={[styles.time, status === 'finished' && styles.timeFinished]}
            numberOfLines={1}
            adjustsFontSizeToFit>
            {timeLabel}
          </Text>

          <View style={styles.actions}>
            {status !== 'finished' ? (
              <Pressable
                testID="training.timerBar.plus30"
                accessibilityRole="button"
                onPress={() => void addSeconds(30)}
                style={styles.chip}>
                <Text style={styles.chipText}>+30</Text>
              </Pressable>
            ) : null}

            {status === 'running' ? (
              <Pressable
                testID="training.timerBar.pause"
                accessibilityRole="button"
                onPress={() => void pause()}
                style={styles.chip}>
                <Text style={styles.chipText}>{t('training.timer.pause')}</Text>
              </Pressable>
            ) : null}

            {status === 'paused' ? (
              <Pressable
                testID="training.timerBar.resume"
                accessibilityRole="button"
                onPress={() => void resume()}
                style={styles.chip}>
                <Text style={styles.chipText}>{t('training.timer.resume')}</Text>
              </Pressable>
            ) : null}

            {status === 'finished' ? (
              <Pressable
                testID="training.timerBar.skip"
                accessibilityRole="button"
                onPress={() => acknowledgeFinished()}
                style={styles.chip}>
                <Text style={styles.chipText}>{t('training.timer.start')}</Text>
              </Pressable>
            ) : (
              <Pressable
                testID="training.timerBar.skip"
                accessibilityRole="button"
                onPress={() => void skip()}
                style={styles.chip}>
                <Text style={styles.chipText}>{t('training.timer.skip')}</Text>
              </Pressable>
            )}
          </View>
        </View>
      </GlassCard>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    // Same horizontal inset as the exercise GlassCard (home tab: px-6).
    // Bottom safe-area comes from the training tab container in home.tsx.
    paddingTop: 8,
  },
  card: {
    // Match TrainingActiveView exerciseCard padding; GlassCard supplies radius 16
    // and colorScheme="light" (stays light under system dark mode).
    padding: 16,
    gap: 12,
  },
  progressTrack: {
    height: 3,
    borderRadius: 999,
    overflow: 'hidden',
    flexDirection: 'row',
    backgroundColor: 'rgba(79, 70, 229, 0.12)',
  },
  progressFill: {
    backgroundColor: BRAND_MINT,
    borderRadius: 999,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  time: {
    // Match TrainingSetInput value size so rest time reads as the primary figure.
    fontSize: 48,
    fontWeight: '600',
    color: BRAND_INDIGO,
    fontVariant: ['tabular-nums'],
    flexShrink: 1,
    minWidth: 0,
  },
  timeFinished: {
    fontSize: 22,
  },
  actions: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
    flexShrink: 0,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: 'rgba(79, 70, 229, 0.1)',
  },
  chipText: {
    color: TEXT_SECONDARY,
    fontWeight: '600',
    fontSize: 13,
  },
});
