import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

import { BRAND_INDIGO, BRAND_MINT, TEXT_SECONDARY, TEXT_TERTIARY } from '@/constants/brand';
import { useTimerTick } from '@/hooks/use-timer-tick';
import { elapsedMs, formatHoldMmSs } from '@/lib/training/rest-timer';
import { formatExerciseTarget } from '@/lib/workouts/format-target';

const RING_SIZE = 160;
const STROKE = 8;
const R = (RING_SIZE - STROKE) / 2;
const CIRC = 2 * Math.PI * R;

type HoldTimerProps = {
  targetSeconds: number | null;
  targetSecondsMax?: number | null;
  perSide?: boolean;
  onStop: (seconds: number, otherSide?: number) => void;
};

export function HoldTimer({
  targetSeconds,
  targetSecondsMax = null,
  perSide = false,
  onStop,
}: HoldTimerProps) {
  const { t } = useTranslation();
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [firstSideSec, setFirstSideSec] = useState<number | null>(null);
  const [awaitingOtherSide, setAwaitingOtherSide] = useState(false);

  const running = startedAt != null;
  const now = useTimerTick(running);
  const elapsed = startedAt != null ? elapsedMs(startedAt, now) : 0;
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

  function handleStart() {
    setStartedAt(Date.now());
  }

  function handleStop() {
    if (startedAt == null) {
      return;
    }
    const seconds = Math.max(0, Math.floor(elapsedMs(startedAt, Date.now()) / 1000));
    setStartedAt(null);

    if (perSide && firstSideSec == null) {
      setFirstSideSec(seconds);
      setAwaitingOtherSide(true);
      return;
    }

    if (perSide && firstSideSec != null) {
      onStop(firstSideSec, seconds);
      setFirstSideSec(null);
      setAwaitingOtherSide(false);
      return;
    }

    onStop(seconds);
  }

  function handleSwitchSide() {
    setAwaitingOtherSide(false);
    setStartedAt(Date.now());
  }

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
            onPress={handleStart}
            style={styles.primary}>
            <Text style={styles.primaryText}>{t('training.timer.start')}</Text>
          </Pressable>
        ) : null}

        {running ? (
          <Pressable
            testID="training.hold.stop"
            accessibilityRole="button"
            onPress={handleStop}
            style={styles.primary}>
            <Text style={styles.primaryText}>{t('training.timer.holdStop')}</Text>
          </Pressable>
        ) : null}

        {awaitingOtherSide && !running ? (
          <Pressable
            testID="training.hold.switchSide"
            accessibilityRole="button"
            onPress={handleSwitchSide}
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
