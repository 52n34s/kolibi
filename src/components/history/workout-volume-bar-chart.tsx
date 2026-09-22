import React from 'react';
import { View } from 'react-native';
import Svg, { Rect } from 'react-native-svg';

import { TRAINING_UNIT_COLORS } from '@/constants/brand';
import type { UnitColorKey } from '@/lib/workouts/types';

export type VolumeBarSegment = {
  value: number;
  colorKey: UnitColorKey;
};

export type VolumeBar = {
  segments: VolumeBarSegment[];
};

type WorkoutVolumeBarChartProps = {
  bars: VolumeBar[];
  width: number;
  height?: number;
  compact?: boolean;
};

export function WorkoutVolumeBarChart({
  bars,
  width,
  height = 140,
  compact = false,
}: WorkoutVolumeBarChartProps) {
  const totals = bars.map((bar) =>
    bar.segments.reduce((sum, segment) => sum + Math.max(0, segment.value), 0),
  );
  const maxValue = Math.max(...totals, 1);
  const plotBottom = height - 12;
  const plotTop = 12;
  const plotHeight = plotBottom - plotTop;
  const barCount = bars.length;
  const gap = compact ? 3 : 8;
  const barWidth = barCount > 0 ? (width - gap * (barCount + 1)) / barCount : 0;

  return (
    <View>
      <Svg width={width} height={height}>
        {bars.map((bar, index) => {
          const total = totals[index] ?? 0;
          const x = gap + index * (barWidth + gap);
          let yCursor = plotBottom;

          if (total <= 0) {
            return (
              <Rect
                key={`vol-empty-${index}`}
                x={x}
                y={plotBottom - 2}
                width={barWidth}
                height={2}
                rx={compact ? 2 : 4}
                fill="#E5E7EB"
                opacity={0.7}
              />
            );
          }

          return (
            <React.Fragment key={`vol-bar-${index}`}>
              {bar.segments.map((segment, segmentIndex) => {
                if (!(segment.value > 0)) {
                  return null;
                }
                const segmentHeight = (segment.value / maxValue) * plotHeight;
                yCursor -= segmentHeight;
                const color =
                  TRAINING_UNIT_COLORS[segment.colorKey] ?? TRAINING_UNIT_COLORS.indigo;
                return (
                  <Rect
                    key={`vol-seg-${index}-${segmentIndex}`}
                    x={x}
                    y={yCursor}
                    width={barWidth}
                    height={Math.max(segmentHeight, 2)}
                    rx={
                      segmentIndex === bar.segments.length - 1
                        ? compact
                          ? 2
                          : 4
                        : 0
                    }
                    fill={color}
                  />
                );
              })}
            </React.Fragment>
          );
        })}
      </Svg>
    </View>
  );
}
