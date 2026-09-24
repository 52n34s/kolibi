import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { RestDurationSheet } from '@/components/training/RestDurationSheet';
import { GlassCard } from '@/components/ui/glass-card';
import { BRAND_INDIGO, BRAND_MINT, TEXT_SECONDARY } from '@/constants/brand';
import { useTimerTick } from '@/hooks/use-timer-tick';
import {
  formatTimerMmSs,
  remainingMs,
  restProgress,
} from '@/lib/training/rest-timer';
import { useRestTimerStore } from '@/stores/rest-timer-store';

/** Minimum tap target (pt). Icons and ±30 chips share this size. */
const CHIP_HIT = 44;

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

  const [editOpen, setEditOpen] = useState(false);
  const [editInitialSec, setEditInitialSec] = useState(durationSec);

  const active = status === 'running' || status === 'paused' || status === 'finished';
  const ticking = status === 'running';
  const now = useTimerTick(ticking);

  useEffect(() => {
    if (status === 'running') {
      markFinishedIfDue(now);
    }
  }, [markFinishedIfDue, now, status]);

  useEffect(() => {
    if (status === 'finished' || status === 'idle') {
      setEditOpen(false);
    }
  }, [status]);

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
  const canEditDuration = status === 'running' || status === 'paused';

  function openEdit() {
    if (!canEditDuration) {
      return;
    }
    setEditInitialSec(Math.max(1, Math.ceil(left / 1000)));
    setEditOpen(true);
  }

  return (
    <View style={styles.wrap}>
      <GlassCard style={styles.card}>
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { flex: Math.max(0.0001, progress) }]} />
          <View style={{ flex: Math.max(0.0001, 1 - progress) }} />
        </View>

        <View style={styles.row}>
          {canEditDuration ? (
            <Pressable
              testID="training.timerBar.time"
              accessibilityRole="button"
              accessibilityLabel={t('training.timer.editA11y')}
              onPress={openEdit}
              style={styles.timePressable}
              hitSlop={4}>
              <Text
                style={styles.time}
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.7}>
                {timeLabel}
              </Text>
            </Pressable>
          ) : (
            <Text
              testID="training.timerBar.time"
              style={[styles.time, styles.timeFinished]}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.7}>
              {timeLabel}
            </Text>
          )}

          {status !== 'finished' ? (
            <>
              <Pressable
                testID="training.timerBar.minus30"
                accessibilityRole="button"
                accessibilityLabel="-30"
                onPress={() => void addSeconds(-30)}
                style={styles.textChip}>
                <Text style={styles.chipText}>-30</Text>
              </Pressable>
              <Pressable
                testID="training.timerBar.plus30"
                accessibilityRole="button"
                accessibilityLabel="+30"
                onPress={() => void addSeconds(30)}
                style={styles.textChip}>
                <Text style={styles.chipText}>+30</Text>
              </Pressable>
            </>
          ) : null}

          {status === 'running' ? (
            <Pressable
              testID="training.timerBar.pause"
              accessibilityRole="button"
              accessibilityLabel={t('training.timer.pauseA11y')}
              onPress={() => void pause()}
              style={styles.iconChip}>
              <Ionicons name="pause" size={22} color={TEXT_SECONDARY} />
            </Pressable>
          ) : null}

          {status === 'paused' ? (
            <Pressable
              testID="training.timerBar.resume"
              accessibilityRole="button"
              accessibilityLabel={t('training.timer.resumeA11y')}
              onPress={() => void resume()}
              style={styles.iconChip}>
              <Ionicons name="play" size={22} color={TEXT_SECONDARY} style={styles.playIcon} />
            </Pressable>
          ) : null}

          {status === 'finished' ? (
            <Pressable
              testID="training.timerBar.skip"
              accessibilityRole="button"
              accessibilityLabel={t('training.timer.start')}
              onPress={() => acknowledgeFinished()}
              style={styles.iconChip}>
              <Ionicons name="play-skip-forward" size={22} color={TEXT_SECONDARY} />
            </Pressable>
          ) : (
            <Pressable
              testID="training.timerBar.skip"
              accessibilityRole="button"
              accessibilityLabel={t('training.timer.skipA11y')}
              onPress={() => void skip()}
              style={styles.iconChip}>
              <Ionicons name="play-skip-forward" size={22} color={TEXT_SECONDARY} />
            </Pressable>
          )}
        </View>
      </GlassCard>

      <RestDurationSheet
        visible={editOpen}
        onClose={() => setEditOpen(false)}
        initialSeconds={editInitialSec}
      />
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
    // Match TrainingActiveView exerciseCard vertical padding; slightly tighter
    // horizontal so 01:22 | −30 | +30 | icons stay one row on iPhone SE (320 pt).
    paddingVertical: 12,
    paddingHorizontal: 10,
    gap: 10,
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
    gap: 2,
    flexWrap: 'nowrap',
  },
  timePressable: {
    flexShrink: 1,
    minWidth: 0,
    marginRight: 2,
    justifyContent: 'center',
    minHeight: CHIP_HIT,
  },
  time: {
    // Compact mm:ss so five controls stay on one row (was 48 before icons).
    fontSize: 24,
    fontWeight: '600',
    color: BRAND_INDIGO,
    fontVariant: ['tabular-nums'],
  },
  timeFinished: {
    fontSize: 18,
    flexGrow: 1,
    flexShrink: 1,
    minWidth: 0,
    marginRight: 2,
  },
  /** ±30: ≥44 tap target; signed numbers need no translation. */
  textChip: {
    minWidth: CHIP_HIT,
    minHeight: CHIP_HIT,
    paddingHorizontal: 6,
    borderRadius: 999,
    backgroundColor: 'rgba(79, 70, 229, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  /** Pause / play / skip: full 44×44 tap target. */
  iconChip: {
    width: CHIP_HIT,
    height: CHIP_HIT,
    borderRadius: 999,
    backgroundColor: 'rgba(79, 70, 229, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  chipText: {
    color: TEXT_SECONDARY,
    fontWeight: '600',
    fontSize: 13,
    fontVariant: ['tabular-nums'],
  },
  playIcon: {
    // Play glyph is optically left-heavy in the glyph box.
    marginLeft: 2,
  },
});
