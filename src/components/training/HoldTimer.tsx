import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

import { BRAND_INDIGO, BRAND_MINT, TEXT_SECONDARY, TEXT_TERTIARY } from '@/constants/brand';
import { useTimerTick } from '@/hooks/use-timer-tick';
import { formatHoldMmSs } from '@/lib/training/rest-timer';
import { formatExerciseTarget } from '@/lib/workouts/format-target';
import {
  holdElapsedMs,
  isHoldRunning,
  type HoldPhase,
} from '@/lib/workouts/hold-phase';

const RING_SIZE = 160;
const STROKE = 8;
const R = (RING_SIZE - STROKE) / 2;
const CIRC = 2 * Math.PI * R;

type HoldTimerProps = {
  /** Owned by TrainingSetInput so it survives value writes — see hold-phase.ts. */
  phase: HoldPhase;
  targetSeconds: number | null;
  targetSecondsMax?: number | null;
  perSide?: boolean;
  onStart: () => void;
  onStop: () => void;
  onSwitchSide: () => void;
};

export function HoldTimer({
  phase,
  targetSeconds,
  targetSecondsMax = null,
  perSide = false,
  onStart,
  onStop,
  onSwitchSide,
}: HoldTimerProps) {
  const { t } = useTranslation();

  const running = isHoldRunning(phase);
  const awaitingOtherSide = phase.status === 'awaitingOtherSide';
  const now = useTimerTick(running);
  const elapsed = holdElapsedMs(phase, now);
  const elapsedSec = Math.floor(elapsed / 1000);

  const lower = targetSeconds != null && targetSeconds > 0 ? targetSeconds : null;
  const atOrPastLower = lower != null && elapsedSec >= lower;
  const ringColor = atOrPastLower ? BRAND_MINT : BRAND_INDIGO;

  const progress = useMemo(() => {
    const goal = targetSecondsMax ?? targetSeconds;
    if (goal == null || !(goal > 0)) {
      return Math.min(1, elapsedSec / 60);
    }
    return Math.min(1, elapsedSec / goal);
  }, [elapsedSec, targetSeconds, targetSecondsMax]);

  const targetLabel = formatExerciseTarget({
    sets: 1,
    kind: 'time',
    seconds: targetSeconds,
    secondsMax: targetSecondsMax,
    perSide,
    perSideLabel: perSide ? t('training.timer.perSide') : null,
  });

  return (
    <View style={styles.wrap}>
      <Text style={styles.target}>{targetLabel}</Text>

      <View style={styles.ringWrap}>
        <Svg width={RING_SIZE} height={RING_SIZE}>
          <Circle
            cx={RING_SIZE / 2}
            cy={RING_SIZE / 2}
            r={R}
            stroke="rgba(79, 70, 229, 0.12)"
            strokeWidth={STROKE}
            fill="none"
          />
          <Circle
            cx={RING_SIZE / 2}
            cy={RING_SIZE / 2}
            r={R}
            stroke={ringColor}
            strokeWidth={STROKE}
            fill="none"
            strokeDasharray={`${CIRC} ${CIRC}`}
            strokeDashoffset={CIRC * (1 - progress)}
            strokeLinecap="round"
            transform={`rotate(-90 ${RING_SIZE / 2} ${RING_SIZE / 2})`}
          />
        </Svg>
        <Text testID="training.hold.time" style={styles.time}>
          {formatHoldMmSs(elapsed)}
        </Text>
      </View>

      {lower != null ? (
        <Text style={styles.hint}>
          {t('training.timer.holdTarget', { seconds: lower })}
        </Text>
      ) : null}

      <View style={styles.actions}>
        {!running && !awaitingOtherSide ? (
          <Pressable
            testID="training.hold.start"
            accessibilityRole="button"
            onPress={onStart}
            style={styles.primary}>
            <Text style={styles.primaryText}>{t('training.timer.start')}</Text>
          </Pressable>
        ) : null}

        {running ? (
          <Pressable
            testID="training.hold.stop"
            accessibilityRole="button"
            onPress={onStop}
            style={styles.primary}>
            <Text style={styles.primaryText}>{t('training.timer.holdStop')}</Text>
          </Pressable>
        ) : null}

        {awaitingOtherSide && !running ? (
          <Pressable
            testID="training.hold.switchSide"
            accessibilityRole="button"
            onPress={onSwitchSide}
            style={styles.primary}>
            <Text style={styles.primaryText}>{t('training.timer.switchSide')}</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    gap: 12,
    paddingVertical: 8,
  },
  target: {
    color: TEXT_SECONDARY,
    fontSize: 14,
    fontWeight: '500',
  },
  ringWrap: {
    width: RING_SIZE,
    height: RING_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  time: {
    position: 'absolute',
    fontSize: 36,
    fontWeight: '600',
    color: BRAND_INDIGO,
    fontVariant: ['tabular-nums'],
  },
  hint: {
    color: TEXT_TERTIARY,
    fontSize: 13,
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
  },
  primary: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 999,
    backgroundColor: BRAND_INDIGO,
  },
  primaryText: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
});
