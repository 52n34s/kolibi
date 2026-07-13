export type ChartPoint = {
  x: number;
  y: number;
};

export function resolveLineChartYDomain(params: {
  values: number[];
  targetWeightKg?: number | null;
  yPaddingKg?: number;
}): { min: number; max: number; range: number } {
  const yPaddingKg = params.yPaddingKg ?? 2;

  if (params.values.length === 0) {
    return { min: 0, max: 1, range: 1 };
  }

  if (params.targetWeightKg == null) {
    const min = Math.min(...params.values);
    const max = Math.max(...params.values);
    const range = max - min || 1;

    return { min, max, range };
  }

  const candidates = [...params.values, params.targetWeightKg];
  let min = Math.min(...candidates);
  let max = Math.max(...candidates);
  min -= yPaddingKg;
  max += yPaddingKg;

  const range = max - min || 1;

  return { min, max, range };
}

export function valueToChartY(params: {
  value: number;
  min: number;
  range: number;
  height: number;
  padding?: number;
}): number {
  const padding = params.padding ?? 16;
  const innerHeight = params.height - padding * 2;

  return padding + (1 - (params.value - params.min) / params.range) * innerHeight;
}

export function buildLineChartPoints(params: {
  values: number[];
  width: number;
  height: number;
  padding?: number;
  targetWeightKg?: number | null;
}): ChartPoint[] {
  const padding = params.padding ?? 16;
  const { values, width, height } = params;

  if (values.length === 0) {
    return [];
  }

  const { min, range } = resolveLineChartYDomain({
    values,
    targetWeightKg: params.targetWeightKg,
  });
  const innerWidth = width - padding * 2;

  return values.map((value, index) => {
    const x =
      values.length === 1
        ? width / 2
        : padding + (index / (values.length - 1)) * innerWidth;
    const y = valueToChartY({ value, min, range, height, padding });

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
