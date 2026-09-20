import { View } from 'react-native';
import Svg, { Circle, ClipPath, Defs, G, Path, Rect } from 'react-native-svg';

import { ONBOARDING_ACCENT } from '@/components/onboarding/onboarding-styles';
import { TEXT_SECONDARY } from '@/constants/brand';
import {
  buildIndexedLineChartPoints,
  pointsToMonotoneXPath,
  resolveLineChartYDomainFromSeries,
} from '@/lib/chart-utils';

const CHART_PADDING = 16;
const GOAL_STROKE = TEXT_SECONDARY;

type MacroTrendChartProps = {
  actual: Array<number | null>;
  goal: Array<number | null>;
  width: number;
  height?: number;
};

export function MacroTrendChart({
  actual,
  goal,
  width,
  height = 180,
}: MacroTrendChartProps) {
  const domain = resolveLineChartYDomainFromSeries([actual, goal]);
  const actualPoints = buildIndexedLineChartPoints({
    values: actual,
    width,
    height,
    padding: CHART_PADDING,
    domain,
  });
  const goalPoints = buildIndexedLineChartPoints({
    values: goal,
    width,
    height,
    padding: CHART_PADDING,
    domain,
  });

  if (actualPoints.length === 0 && goalPoints.length === 0) {
    return null;
  }

  const actualPath = pointsToMonotoneXPath(actualPoints);
  const goalPath = pointsToMonotoneXPath(goalPoints);

  return (
    <View style={{ width, height, overflow: 'hidden' }}>
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
          {actualPoints.map((point, index) =>
            actualPoints.length === 1 ? (
              <Circle
                key={`macro-actual-${index}`}
                cx={point.x}
                cy={point.y}
                r={6}
                fill={ONBOARDING_ACCENT}
              />
            ) : (
              <Circle
                key={`macro-actual-${index}`}
                cx={point.x}
                cy={point.y}
                r={4}
                fill="#FFFFFF"
                stroke={ONBOARDING_ACCENT}
                strokeWidth={2}
              />
            ),
          )}
        </G>
      </Svg>
    </View>
  );
}
