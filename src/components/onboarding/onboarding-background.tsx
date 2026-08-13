import { StyleSheet, useWindowDimensions, View } from 'react-native';
import Svg, { Defs, G, RadialGradient, Rect, Stop } from 'react-native-svg';

import { BEAM_INDIGO, SURFACE_BASE } from '@/constants/brand';

const BEAM_ID = 'indigoBeam';
const BEAM_LOWER_ID = 'indigoBeamLower';
const BEAM_WIDTH_SCALE = 2.2;
const BEAM_HEIGHT_SCALE = 1.0;

export function OnboardingMeshBackground() {
  const { width, height } = useWindowDimensions();
  const originX = width / 2;
  const originY = height * 0.34;
  const lowerOriginY = height * 0.78;
  const beamWidth = width * BEAM_WIDTH_SCALE;
  const beamHeight = height * BEAM_HEIGHT_SCALE;

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <Svg width={width} height={height} style={StyleSheet.absoluteFill}>
        <Defs>
          <RadialGradient
            id={BEAM_ID}
            cx={0.5}
            cy={0.34}
            rx={0.95}
            ry={0.2}
            gradientUnits="objectBoundingBox">
            <Stop offset="0" stopColor={BEAM_INDIGO} stopOpacity={0.34} />
            <Stop offset="0.35" stopColor={BEAM_INDIGO} stopOpacity={0.2} />
            <Stop offset="0.7" stopColor={BEAM_INDIGO} stopOpacity={0.06} />
            <Stop offset="1" stopColor={BEAM_INDIGO} stopOpacity={0} />
          </RadialGradient>
          <RadialGradient
            id={BEAM_LOWER_ID}
            cx={0.5}
            cy={0.78}
            rx={0.95}
            ry={0.18}
            gradientUnits="objectBoundingBox">
            <Stop offset="0" stopColor={BEAM_INDIGO} stopOpacity={0.26} />
            <Stop offset="0.35" stopColor={BEAM_INDIGO} stopOpacity={0.15} />
            <Stop offset="0.7" stopColor={BEAM_INDIGO} stopOpacity={0.05} />
            <Stop offset="1" stopColor={BEAM_INDIGO} stopOpacity={0} />
          </RadialGradient>
        </Defs>

        <Rect width="100%" height="100%" fill={SURFACE_BASE} />

        <G rotation={-18} originX={originX} originY={originY}>
          <Rect
            x={originX - 0.5 * beamWidth}
            y={originY - 0.34 * beamHeight}
            width={beamWidth}
            height={beamHeight}
            fill={`url(#${BEAM_ID})`}
          />
          <Rect
            x={originX - 0.5 * beamWidth}
            y={lowerOriginY - 0.78 * beamHeight}
            width={beamWidth}
            height={beamHeight}
            fill={`url(#${BEAM_LOWER_ID})`}
          />
        </G>
      </Svg>
    </View>
  );
}
