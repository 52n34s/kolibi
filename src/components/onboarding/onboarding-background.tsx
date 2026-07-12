import { StyleSheet, useWindowDimensions, View } from 'react-native';
import Svg, { Defs, RadialGradient, Rect, Stop } from 'react-native-svg';

import {
  ONBOARDING_ACCENT,
  ONBOARDING_BACKGROUND,
  ONBOARDING_MINT,
} from './onboarding-styles';

const MESH_BLOBS = [
  {
    id: 'indigoUpper',
    color: ONBOARDING_ACCENT,
    cx: 0.22,
    cy: 0.16,
    rx: 0.72,
    ry: 0.55,
    peakOpacity: 0.42,
    midOpacity: 0.2,
  },
  {
    id: 'mintLower',
    color: ONBOARDING_MINT,
    cx: 0.78,
    cy: 0.74,
    rx: 0.68,
    ry: 0.58,
    peakOpacity: 0.4,
    midOpacity: 0.19,
  },
  {
    id: 'indigoMidRight',
    color: ONBOARDING_ACCENT,
    cx: 0.68,
    cy: 0.42,
    rx: 0.5,
    ry: 0.4,
    peakOpacity: 0.24,
    midOpacity: 0.11,
  },
  {
    id: 'mintUpperCenter',
    color: ONBOARDING_MINT,
    cx: 0.48,
    cy: 0.28,
    rx: 0.46,
    ry: 0.32,
    peakOpacity: 0.22,
    midOpacity: 0.1,
  },
  {
    id: 'indigoFooter',
    color: ONBOARDING_ACCENT,
    cx: 0.72,
    cy: 0.9,
    rx: 0.62,
    ry: 0.42,
    peakOpacity: 0.3,
    midOpacity: 0.14,
  },
  {
    id: 'mintFooter',
    color: ONBOARDING_MINT,
    cx: 0.28,
    cy: 0.94,
    rx: 0.58,
    ry: 0.38,
    peakOpacity: 0.28,
    midOpacity: 0.13,
  },
] as const;

export function OnboardingMeshBackground() {
  const { width, height } = useWindowDimensions();

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <Svg width={width} height={height} style={StyleSheet.absoluteFill}>
        <Defs>
          {MESH_BLOBS.map((blob) => (
            <RadialGradient
              key={blob.id}
              id={blob.id}
              cx={blob.cx}
              cy={blob.cy}
              rx={blob.rx}
              ry={blob.ry}
              gradientUnits="objectBoundingBox">
              <Stop offset="0" stopColor={blob.color} stopOpacity={blob.peakOpacity} />
              <Stop offset="0.4" stopColor={blob.color} stopOpacity={blob.midOpacity} />
              <Stop offset="0.75" stopColor={blob.color} stopOpacity={0.04} />
              <Stop offset="1" stopColor={blob.color} stopOpacity={0} />
            </RadialGradient>
          ))}
        </Defs>

        <Rect width="100%" height="100%" fill={ONBOARDING_BACKGROUND} />

        {MESH_BLOBS.map((blob) => (
          <Rect key={`${blob.id}-layer`} width="100%" height="100%" fill={`url(#${blob.id})`} />
        ))}
      </Svg>
    </View>
  );
}
