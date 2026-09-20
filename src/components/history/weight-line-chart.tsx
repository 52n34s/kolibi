import { View } from 'react-native';
import Svg, {
  Circle,
  ClipPath,
  Defs,
  G,
  Line,
  Polyline,
  Rect,
  Text as SvgText,
} from 'react-native-svg';

import { ONBOARDING_MINT, ONBOARDING_ACCENT } from '@/components/onboarding/onboarding-styles';
import {
  buildLineChartPoints,
  resolveLineChartYDomain,
  valueToChartY,
  pointsToPolyline,
  isValueInYDomain,
} from '@/lib/chart-utils';

const TARGET_LINE_COLOR = ONBOARDING_MINT;
const CHART_PADDING = 16;

type WeightLineChartProps = {
  values: number[];
  width: number;
  height?: number;
  targetWeightKg?: number | null;
  targetLabel?: string | null;
  /** Format a kg delta for the edge marker, e.g. "+1,2 kg". */
  formatDeltaKg?: (deltaKg: number) => string;
};

export function WeightLineChart({
  values,
  width,
  height = 180,
  targetWeightKg = null,
  targetLabel = null,
  formatDeltaKg,
}: WeightLineChartProps) {
  const points = buildLineChartPoints({
    values,
    width,
    height,
    padding: CHART_PADDING,
  });

  if (points.length === 0) {
    return null;
  }

  const yDomain = resolveLineChartYDomain({ values });
  const targetVisible = isValueInYDomain(targetWeightKg, yDomain);

  const targetY = targetVisible
    ? valueToChartY({
        value: targetWeightKg!,
        min: yDomain.min,
        range: yDomain.range,
        height,
        padding: CHART_PADDING,
      })
    : null;

  const targetOutside = targetWeightKg != null && !targetVisible;
  const edgeY = targetOutside
    ? targetWeightKg > yDomain.max
      ? CHART_PADDING
      : height - CHART_PADDING
    : null;
  const edgeDelta =
    targetOutside && targetWeightKg != null
      ? targetWeightKg - (targetWeightKg > yDomain.max ? yDomain.max : yDomain.min)
      : null;

  return (
    <View style={{ width, height, overflow: 'hidden' }}>
      <Svg width={width} height={height}>
        <Defs>
          <ClipPath id="weight-chart-clip">
            <Rect x={0} y={0} width={width} height={height} />
          </ClipPath>
        </Defs>
        <G clipPath="url(#weight-chart-clip)">
          {targetVisible && targetY != null ? (
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
              {targetLabel ? (
                <SvgText
                  x={width - CHART_PADDING}
                  y={targetY - 6}
                  fill={TARGET_LINE_COLOR}
                  fontSize={11}
                  fontWeight="600"
                  textAnchor="end">
                  {targetLabel}
                </SvgText>
              ) : null}
            </>
          ) : null}

          {edgeY != null && edgeDelta != null ? (
            <SvgText
              x={width - CHART_PADDING}
              y={edgeY + (targetWeightKg! > yDomain.max ? 12 : -6)}
              fill={TARGET_LINE_COLOR}
              fontSize={11}
              fontWeight="600"
              textAnchor="end">
              {targetLabel
                ? `${targetLabel} (${formatDeltaKg ? formatDeltaKg(edgeDelta) : `${edgeDelta > 0 ? '+' : ''}${edgeDelta.toFixed(1)} kg`})`
                : formatDeltaKg
                  ? formatDeltaKg(edgeDelta)
                  : `${edgeDelta > 0 ? '+' : ''}${edgeDelta.toFixed(1)} kg`}
            </SvgText>
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
        </G>
      </Svg>
    </View>
  );
}
