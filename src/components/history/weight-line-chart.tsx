import Svg, { Circle, Polyline } from 'react-native-svg';

import { ONBOARDING_ACCENT } from '@/components/onboarding/onboarding-styles';
import { buildLineChartPoints, pointsToPolyline } from '@/lib/chart-utils';

type WeightLineChartProps = {
  values: number[];
  width: number;
  height?: number;
};

export function WeightLineChart({ values, width, height = 180 }: WeightLineChartProps) {
  const points = buildLineChartPoints({ values, width, height });

  if (points.length === 0) {
    return null;
  }

  return (
    <Svg width={width} height={height}>
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
