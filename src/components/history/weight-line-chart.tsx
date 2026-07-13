import Svg, { Circle, Line, Polyline, Text as SvgText } from 'react-native-svg';

import { ONBOARDING_MINT, ONBOARDING_ACCENT } from '@/components/onboarding/onboarding-styles';
import {
  buildLineChartPoints,
  resolveLineChartYDomain,
  valueToChartY,
  pointsToPolyline,
} from '@/lib/chart-utils';

const TARGET_LINE_COLOR = ONBOARDING_MINT;
const CHART_PADDING = 16;

type WeightLineChartProps = {
  values: number[];
  width: number;
  height?: number;
  targetWeightKg?: number | null;
  targetLabel?: string | null;
};

export function WeightLineChart({
  values,
  width,
  height = 180,
  targetWeightKg = null,
  targetLabel = null,
}: WeightLineChartProps) {
  const points = buildLineChartPoints({
    values,
    width,
    height,
    padding: CHART_PADDING,
    targetWeightKg,
  });

  if (points.length === 0) {
    return null;
  }

  const yDomain = resolveLineChartYDomain({ values, targetWeightKg });
  const showTargetLine = targetWeightKg != null && targetLabel != null;
  const targetY = showTargetLine
    ? valueToChartY({
        value: targetWeightKg,
        min: yDomain.min,
        range: yDomain.range,
        height,
        padding: CHART_PADDING,
      })
    : null;

  return (
    <Svg width={width} height={height}>
      {showTargetLine && targetY != null ? (
        <>
          <Line
            x1={CHART_PADDING}
            y1={targetY}
            x2={width - CHART_PADDING}
            y2={targetY}
            stroke={TARGET_LINE_COLOR}
            strokeWidth={1.5}
            strokeDasharray="6 4"
          />
          <SvgText
            x={width - CHART_PADDING}
            y={targetY - 6}
            fill={TARGET_LINE_COLOR}
            fontSize={11}
            fontWeight="600"
            textAnchor="end">
            {targetLabel}
          </SvgText>
        </>
      ) : null}

      {points.length === 1 ? (
        <Circle cx={points[0].x} cy={points[0].y} r={6} fill={ONBOARDING_ACCENT} />
      ) : (
        <>
          <Polyline
            points={pointsToPolyline(points)}
            fill="none"
            stroke={ONBOARDING_ACCENT}
            strokeWidth={3}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
          {points.map((point, index) => (
            <Circle
              key={`weight-point-${index}`}
              cx={point.x}
              cy={point.y}
              r={4}
              fill="#FFFFFF"
              stroke={ONBOARDING_ACCENT}
              strokeWidth={2}
            />
          ))}
        </>
      )}
    </Svg>
  );
}
