import { Text, View } from 'react-native';
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
  /** Small in-chart note, e.g. "30 Tage" when waist ignores the 7-day range. */
  rangeBadge?: string | null;
};

export function WeightLineChart({
  values,
  width,
  height = 180,
  targetWeightKg = null,
  targetLabel = null,
  formatDeltaKg,
  rangeBadge = null,
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
  const targetAbove = targetOutside && targetWeightKg! > yDomain.max;
  /**
   * Off-scale marker sits outside the plotted band, not on its edge. Inside the
   * band it lands level with the nearest point and reads as if the target were
   * that value — which is exactly the clamping the domain fix removed.
   */
  const edgeY = targetOutside ? (targetAbove ? 11 : height - 5) : null;
  const edgeDelta = targetOutside
    ? targetWeightKg! - (targetAbove ? yDomain.max : yDomain.min)
    : null;

  return (
    <View style={{ width, height, overflow: 'hidden' }}>
      {rangeBadge ? (
        <Text
          style={{
            position: 'absolute',
            top: 4,
            left: 4,
            zIndex: 1,
            fontSize: 11,
            fontWeight: '600',
            color: '#9CA3AF',
          }}>
          {rangeBadge}
        </Text>
      ) : null}
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
              y={edgeY}
              fill={TARGET_LINE_COLOR}
              fontSize={11}
              fontWeight="600"
              textAnchor="end">
              {/* Arrow says the target is off the visible scale, not at this height. */}
              {`${targetAbove ? '↑' : '↓'} ${
                targetLabel
                  ? `${targetLabel} (${formatDeltaKg ? formatDeltaKg(edgeDelta) : `${edgeDelta > 0 ? '+' : edgeDelta < 0 ? '−' : ''}${Math.abs(edgeDelta).toFixed(1)} kg`})`
                  : formatDeltaKg
                    ? formatDeltaKg(edgeDelta)
                    : `${edgeDelta > 0 ? '+' : edgeDelta < 0 ? '−' : ''}${Math.abs(edgeDelta).toFixed(1)} kg`
              }`}
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
