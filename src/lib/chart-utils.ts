export type ChartPoint = {
  x: number;
  y: number;
};

export type LineChartYDomain = {
  min: number;
  max: number;
  range: number;
};

/** Y-domain from plotted values only. Target weight must not stretch or clamp this. */
export function resolveLineChartYDomain(params: {
  values: number[];
}): LineChartYDomain {
  if (params.values.length === 0) {
    return { min: 0, max: 1, range: 1 };
  }

  const min = Math.min(...params.values);
  const max = Math.max(...params.values);
  const range = max - min || 1;

  return { min, max, range };
}

export function isValueInYDomain(
  value: number | null | undefined,
  domain: Pick<LineChartYDomain, 'min' | 'max'>,
): boolean {
  return value != null && value >= domain.min && value <= domain.max;
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
}): ChartPoint[] {
  const padding = params.padding ?? 16;
  const { values, width, height } = params;

  if (values.length === 0) {
    return [];
  }

  const { min, range } = resolveLineChartYDomain({ values });
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

export function resolveLineChartYDomainFromSeries(
  series: Array<Array<number | null | undefined>>,
): LineChartYDomain {
  const values: number[] = [];
  for (const row of series) {
    for (const value of row) {
      if (value != null && Number.isFinite(value)) {
        values.push(value);
      }
    }
  }
  return resolveLineChartYDomain({ values });
}

/** X from the value's index in the full range so gaps keep their calendar slot. */
export function buildIndexedLineChartPoints(params: {
  values: Array<number | null | undefined>;
  width: number;
  height: number;
  padding?: number;
  domain: LineChartYDomain;
}): ChartPoint[] {
  const padding = params.padding ?? 16;
  const { values, width, height, domain } = params;
  const count = values.length;
  if (count === 0) {
    return [];
  }

  const innerWidth = width - padding * 2;
  const points: ChartPoint[] = [];
  for (let index = 0; index < count; index += 1) {
    const value = values[index];
    if (value == null || !Number.isFinite(value)) {
      continue;
    }
    const x =
      count === 1 ? width / 2 : padding + (index / (count - 1)) * innerWidth;
    const y = valueToChartY({
      value,
      min: domain.min,
      range: domain.range,
      height,
      padding,
    });
    points.push({ x, y });
  }
  return points;
}

export type CubicSegment = {
  from: ChartPoint;
  c1: ChartPoint;
  c2: ChartPoint;
  to: ChartPoint;
};

/**
 * Fritsch–Carlson monotone cubic (d3 curveMonotoneX). Does not overshoot
 * between adjacent points, so 49 g → 160 g cannot dip below zero.
 */
export function buildMonotoneXCubicSegments(points: ChartPoint[]): CubicSegment[] {
  const n = points.length;
  if (n < 2) {
    return [];
  }

  const dx: number[] = [];
  const dy: number[] = [];
  const slope: number[] = [];
  for (let i = 0; i < n - 1; i += 1) {
    const deltaX = points[i + 1]!.x - points[i]!.x;
    const deltaY = points[i + 1]!.y - points[i]!.y;
    dx.push(deltaX);
    dy.push(deltaY);
    slope.push(deltaX === 0 ? 0 : deltaY / deltaX);
  }

  const tangent = new Array<number>(n);
  tangent[0] = slope[0]!;
  tangent[n - 1] = slope[n - 2]!;
  for (let i = 1; i < n - 1; i += 1) {
    const prev = slope[i - 1]!;
    const next = slope[i]!;
    tangent[i] = prev * next <= 0 ? 0 : (prev + next) / 2;
  }

  for (let i = 0; i < n - 1; i += 1) {
    if (slope[i] === 0) {
      tangent[i] = 0;
      tangent[i + 1] = 0;
      continue;
    }
    const a = tangent[i]! / slope[i]!;
    const b = tangent[i + 1]! / slope[i]!;
    const s = a * a + b * b;
    if (s > 9) {
      const t = 3 / Math.sqrt(s);
      tangent[i] = t * a * slope[i]!;
      tangent[i + 1] = t * b * slope[i]!;
    }
  }

  const segments: CubicSegment[] = [];
  for (let i = 0; i < n - 1; i += 1) {
    const from = points[i]!;
    const to = points[i + 1]!;
    const dx3 = dx[i]! / 3;
    segments.push({
      from,
      c1: { x: from.x + dx3, y: from.y + tangent[i]! * dx3 },
      c2: { x: to.x - dx3, y: to.y - tangent[i + 1]! * dx3 },
      to,
    });
  }
  return segments;
}

export function pointsToMonotoneXPath(points: ChartPoint[]): string {
  if (points.length === 0) {
    return '';
  }
  const start = points[0]!;
  if (points.length === 1) {
    return `M ${start.x} ${start.y}`;
  }
  const segments = buildMonotoneXCubicSegments(points);
  let path = `M ${start.x} ${start.y}`;
  for (const segment of segments) {
    path += ` C ${segment.c1.x} ${segment.c1.y} ${segment.c2.x} ${segment.c2.y} ${segment.to.x} ${segment.to.y}`;
  }
  return path;
}

export function sampleCubicSegmentY(segment: CubicSegment, t: number): number {
  const u = 1 - t;
  return (
    u * u * u * segment.from.y +
    3 * u * u * t * segment.c1.y +
    3 * u * t * t * segment.c2.y +
    t * t * t * segment.to.y
  );
}

export function pointsToPolyline(points: ChartPoint[]): string {
  return points.map((point) => `${point.x},${point.y}`).join(' ');
}
