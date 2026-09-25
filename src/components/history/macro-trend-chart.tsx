import { useRef, useState } from 'react';
import { Pressable, Text, View, type GestureResponderEvent } from 'react-native';
import Svg, { Circle, ClipPath, Defs, G, Path, Rect } from 'react-native-svg';

import { ONBOARDING_ACCENT } from '@/components/onboarding/onboarding-styles';
import { TEXT_SECONDARY } from '@/constants/brand';
import { buildIndexedLineChartPoints, pointsToMonotoneXPath } from '@/lib/chart-utils';
import { selectionHaptic } from '@/lib/haptics';
import { macroChartDomain, macroIndexAtX } from '@/lib/history-macro-trend';

const CHART_PADDING = 16;
const GOAL_STROKE = TEXT_SECONDARY;
const BUBBLE_WIDTH = 190;

export type MacroBubble = {
  text: string;
  /** "Ziel angepasst" on the day the goal changed. */
  note?: string | null;
};

type MacroTrendChartProps = {
  actual: Array<number | null>;
  goal: Array<number | null>;
  width: number;
  height?: number;
  /** Index of today: drawn as a hollow point, it is still running. */
  todayIndex?: number | null;
  /** Bubble for a day, null when there is nothing to show. */
  bubbleFor?: (index: number) => MacroBubble | null;
  /** Tap on the bubble. */
  onOpenDay?: (index: number) => void;
  openDayLabel?: string;
};

export function MacroTrendChart({
  actual,
  goal,
  width,
  height = 180,
  todayIndex = null,
  bubbleFor,
  onOpenDay,
  openDayLabel,
}: MacroTrendChartProps) {
  const [selected, setSelected] = useState<number | null>(null);
  const selectedRef = useRef<number | null>(null);

  // From 0, with air above the goal line and the highest value.
  const domain = macroChartDomain([actual, goal]);
  const params = { width, height, padding: CHART_PADDING, domain };
  const actualPoints = buildIndexedLineChartPoints({ ...params, values: actual });
  const goalPoints = buildIndexedLineChartPoints({ ...params, values: goal });

  if (actualPoints.length === 0 && goalPoints.length === 0) {
    return null;
  }

  // Indices of the plotted actual points, for today and the selection.
  const actualIndices = actual
    .map((value, index) => (value != null && Number.isFinite(value) ? index : -1))
    .filter((index) => index >= 0);

  const actualPath = pointsToMonotoneXPath(actualPoints);
  const goalPath = pointsToMonotoneXPath(goalPoints);

  function select(event: GestureResponderEvent) {
    if (!bubbleFor) {
      return;
    }
    const index = macroIndexAtX({
      x: event.nativeEvent.locationX,
      count: actual.length,
      width,
      padding: CHART_PADDING,
    });
    if (index !== selectedRef.current) {
      selectedRef.current = index;
      setSelected(index);
      selectionHaptic();
    }
  }

  const bubble = selected != null && bubbleFor ? bubbleFor(selected) : null;
  const bubblePointIndex = selected != null ? actualIndices.indexOf(selected) : -1;
  const bubblePoint = bubblePointIndex >= 0 ? actualPoints[bubblePointIndex] : null;
  const bubbleX =
    selected == null
      ? 0
      : actual.length <= 1
        ? width / 2
        : CHART_PADDING + (selected / (actual.length - 1)) * (width - CHART_PADDING * 2);
  const bubbleLeft = Math.min(Math.max(0, bubbleX - BUBBLE_WIDTH / 2), width - BUBBLE_WIDTH);

  return (
    <View style={{ width, height }}>
      <View
        style={{ width, height, overflow: 'hidden' }}
        onStartShouldSetResponder={() => Boolean(bubbleFor)}
        onMoveShouldSetResponder={() => Boolean(bubbleFor)}
        onResponderGrant={select}
        onResponderMove={select}
        // Vertical scrolling of the page may take over.
        onResponderTerminationRequest={() => true}>
        <Svg width={width} height={height}>
          <Defs>
            <ClipPath id="macro-trend-clip">
              <Rect x={0} y={0} width={width} height={height} />
            </ClipPath>
          </Defs>
          <G clipPath="url(#macro-trend-clip)">
            {goalPath ? (
              <Path
                d={goalPath}
                fill="none"
                stroke={GOAL_STROKE}
                strokeWidth={1.5}
                strokeDasharray="6 4"
                strokeLinejoin="round"
                strokeLinecap="round"
              />
            ) : null}
            {actualPath && actualPoints.length > 1 ? (
              <Path
                d={actualPath}
                fill="none"
                stroke={ONBOARDING_ACCENT}
                strokeWidth={3}
                strokeLinejoin="round"
                strokeLinecap="round"
              />
            ) : null}
            {bubblePoint ? (
              <Circle cx={bubblePoint.x} cy={bubblePoint.y} r={9} fill={ONBOARDING_ACCENT} opacity={0.18} />
            ) : null}
            {actualPoints.map((point, index) => {
              const running = actualIndices[index] === todayIndex;
              return (
                <Circle
                  key={`macro-actual-${index}`}
                  cx={point.x}
                  cy={point.y}
                  r={running ? 5 : 4}
                  // Today is hollow: still running, not a finished (weak) day.
                  fill={running ? '#FFFFFF' : ONBOARDING_ACCENT}
                  stroke={ONBOARDING_ACCENT}
                  strokeWidth={2}
                  strokeDasharray={running ? '2 2' : undefined}
                />
              );
            })}
          </G>
        </Svg>
      </View>
      {bubble && selected != null ? (
        <Pressable
          testID="history.macro.bubble"
          accessibilityRole="button"
          accessibilityLabel={openDayLabel ? `${bubble.text}. ${openDayLabel}` : bubble.text}
          onPress={() => onOpenDay?.(selected)}
          style={{
            position: 'absolute',
            top: 0,
            left: bubbleLeft,
            width: BUBBLE_WIDTH,
            alignItems: 'center',
          }}>
          <View
            style={{
              paddingHorizontal: 10,
              paddingVertical: 6,
              borderRadius: 12,
              backgroundColor: '#1E1B4B',
              alignItems: 'center',
            }}>
            <Text style={{ color: '#FFFFFF', fontSize: 13, fontWeight: '600' }}>{bubble.text}</Text>
            {bubble.note ? (
              <Text style={{ color: 'rgba(255,255,255,0.75)', fontSize: 11, marginTop: 1 }}>
                {bubble.note}
              </Text>
            ) : null}
          </View>
        </Pressable>
      ) : null}
    </View>
  );
}
