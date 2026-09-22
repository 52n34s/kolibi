import { View } from 'react-native';
import Svg, { Polyline } from 'react-native-svg';

import { BRAND_INDIGO } from '@/constants/brand';

type MiniSparklineProps = {
  values: number[];
  width?: number;
  height?: number;
  color?: string;
};

export function MiniSparkline({
  values,
  width = 56,
  height = 24,
  color = BRAND_INDIGO,
}: MiniSparklineProps) {
  if (values.length < 2) {
    return <View style={{ width, height }} />;
  }

  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = Math.max(max - min, 1);
  const padY = 2;
  const usable = height - padY * 2;
  const stepX = width / (values.length - 1);
  const points = values
    .map((value, index) => {
      const x = index * stepX;
      const y = padY + usable - ((value - min) / span) * usable;
      return `${x},${y}`;
    })
    .join(' ');

  return (
    <Svg width={width} height={height}>
      <Polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth={1.5}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </Svg>
  );
}
