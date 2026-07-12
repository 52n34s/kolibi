export type ChartPoint = {
  x: number;
  y: number;
};

export function buildLineChartPoints(params: {
  values: number[];
  width: number;
  height: number;
  padding?: number;
}): ChartPoint[] {
  const padding = params.padding ?? 16;
  const { values, width, height } = params;

  if (values.length === 0) {
    return [];
  }

  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const innerWidth = width - padding * 2;
  const innerHeight = height - padding * 2;

  return values.map((value, index) => {
    const x =
      values.length === 1
        ? width / 2
        : padding + (index / (values.length - 1)) * innerWidth;
    const y = padding + (1 - (value - min) / range) * innerHeight;

    return { x, y };
  });
}

export function buildBarChartHeights(values: number[], maxHeight: number): number[] {
  const maxValue = Math.max(...values, 1);

  return values.map((value) => (value / maxValue) * maxHeight);
}

export function pointsToPolyline(points: ChartPoint[]): string {
  return points.map((point) => `${point.x},${point.y}`).join(' ');
}
