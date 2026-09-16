import React from 'react';
import { Pressable, View } from 'react-native';
import Svg, { Line, Rect } from 'react-native-svg';

import { ONBOARDING_ACCENT } from '@/components/onboarding/onboarding-styles';

type CalorieBarChartProps = {
  values: number[];
  /** Per-bar calorie goal; draws a thin mark on each bar when set. */
  goals?: Array<number | null | undefined>;
  width: number;
  height?: number;
  onBarPress?: (index: number) => void;
  /** Narrower bars for denser ranges (e.g. 30 days). */
  compact?: boolean;
};

export function CalorieBarChart({
  values,
  goals,
  width,
  height = 180,
  onBarPress,
  compact = false,
}: CalorieBarChartProps) {
  // Scale so the tallest bar *or* goal-on-a-logged-day fits — empty days get no mark.
  const maxValue = Math.max(
    ...values,
    ...(goals ?? []).map((goal, index) =>
      (values[index] ?? 0) > 0 && goal != null ? goal : 0,
    ),
    1,
  );
  const plotBottom = height - 12;
  const plotTop = 12;
  const plotHeight = plotBottom - plotTop;
  const barHeights = values.map((value) => (value / maxValue) * plotHeight);
  const barCount = values.length;
  const gap = compact ? 3 : 8;
  const barWidth = barCount > 0 ? (width - gap * (barCount + 1)) / barCount : 0;

  return (
    <View>
      <Svg width={width} height={height}>
        {values.map((value, index) => {
          const barHeight = barHeights[index] ?? 0;
          const x = gap + index * (barWidth + gap);
          const y = plotBottom - barHeight;
          const goal = goals?.[index];
          const goalY =
            value > 0 && goal != null && goal > 0
              ? plotBottom - (goal / maxValue) * plotHeight
              : null;

          return (
            <React.Fragment key={`calorie-bar-${index}`}>
              <Rect
                x={x}
                y={y}
                width={barWidth}
                height={Math.max(barHeight, value > 0 ? 4 : 2)}
                rx={compact ? 2 : 4}
                fill={value > 0 ? ONBOARDING_ACCENT : '#E5E7EB'}
                opacity={value > 0 ? 1 : 0.7}
              />
              {goalY != null ? (
                <Line
                  x1={x}
                  y1={goalY}
                  x2={x + barWidth}
                  y2={goalY}
                  stroke="rgba(107, 114, 128, 0.4)"
                  strokeWidth={1}
                  strokeLinecap="butt"
                />
              ) : null}
            </React.Fragment>
          );
        })}
      </Svg>
      {onBarPress ? (
        <View
          pointerEvents="box-none"
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            width,
            height,
            flexDirection: 'row',
          }}>
          {values.map((_, index) => {
            const x = gap + index * (barWidth + gap);
            return (
              <Pressable
                key={`calorie-bar-hit-${index}`}
                accessibilityRole="button"
                onPress={() => onBarPress(index)}
                style={{
                  position: 'absolute',
                  left: x,
                  top: 0,
                  width: barWidth,
                  height,
                }}
              />
            );
          })}
        </View>
      ) : null}
    </View>
  );
}
