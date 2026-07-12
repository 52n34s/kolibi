import { View } from 'react-native';
import Svg, { Rect } from 'react-native-svg';

import { ONBOARDING_ACCENT } from '@/components/onboarding/onboarding-styles';
import { buildBarChartHeights } from '@/lib/chart-utils';

type CalorieBarChartProps = {
  values: number[];
  width: number;
  height?: number;
};

export function CalorieBarChart({ values, width, height = 180 }: CalorieBarChartProps) {
  const barHeights = buildBarChartHeights(values, height - 24);
  const barCount = values.length;
  const gap = 8;
  const barWidth = barCount > 0 ? (width - gap * (barCount + 1)) / barCount : 0;

  return (
    <View>
      <Svg width={width} height={height}>
        {values.map((value, index) => {
          const barHeight = barHeights[index] ?? 0;
          const x = gap + index * (barWidth + gap);
          const y = height - 12 - barHeight;

          return (
            <Rect
              key={`calorie-bar-${index}`}
              x={x}
              y={y}
              width={barWidth}
              height={Math.max(barHeight, value > 0 ? 4 : 2)}
              rx={4}
              fill={value > 0 ? ONBOARDING_ACCENT : '#E5E7EB'}
              opacity={value > 0 ? 1 : 0.7}
            />
          );
        })}
      </Svg>
    </View>
  );
}
