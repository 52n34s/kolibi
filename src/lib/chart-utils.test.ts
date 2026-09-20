import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  buildIndexedLineChartPoints,
  buildLineChartPoints,
  buildMonotoneXCubicSegments,
  isValueInYDomain,
  pointsToMonotoneXPath,
  resolveLineChartYDomain,
  resolveLineChartYDomainFromSeries,
  sampleCubicSegmentY,
  valueToChartY,
} from './chart-utils.ts';

describe('resolveLineChartYDomain', () => {
  it('uses only the data min/max — a distant target is not part of the domain', () => {
    const domain = resolveLineChartYDomain({ values: [87.8, 88.4, 88.7] });

    assert.equal(domain.min, 87.8);
    assert.equal(domain.max, 88.7);
    assert.ok(Math.abs(domain.range - (88.7 - 87.8)) < 1e-10);
    assert.equal(isValueInYDomain(77, domain), false);
    assert.equal(isValueInYDomain(87.8, domain), true);
  });

  it('falls back to a 1 kg range when every point is the same', () => {
    const domain = resolveLineChartYDomain({ values: [80, 80] });

    assert.equal(domain.min, 80);
    assert.equal(domain.max, 80);
    assert.equal(domain.range, 1);
  });
});

describe('valueToChartY', () => {
  const height = 180;
  const padding = 16;

  it('maps data min to the inner bottom — the same y a clamped target line would use', () => {
    const domain = resolveLineChartYDomain({ values: [87.8, 88.7] });
    const minY = valueToChartY({
      value: domain.min,
      min: domain.min,
      range: domain.range,
      height,
      padding,
    });
    const clampedTargetY = height - padding;

    assert.equal(minY, clampedTargetY);
  });

  it('maps data max to the inner top', () => {
    const domain = resolveLineChartYDomain({ values: [87.8, 88.7] });
    const maxY = valueToChartY({
      value: domain.max,
      min: domain.min,
      range: domain.range,
      height,
      padding,
    });

    assert.equal(maxY, padding);
  });
});

describe('buildLineChartPoints', () => {
  it('keeps every vertex inside the padded plot', () => {
    const width = 300;
    const height = 180;
    const padding = 16;
    const points = buildLineChartPoints({
      values: [87.8, 88.1, 88.7],
      width,
      height,
      padding,
    });

    assert.equal(points.length, 3);
    for (const point of points) {
      assert.ok(point.x >= padding);
      assert.ok(point.x <= width - padding);
      assert.ok(point.y >= padding);
      assert.ok(point.y <= height - padding);
    }
  });
});

describe('buildIndexedLineChartPoints', () => {
  it('keeps calendar x for a gap instead of packing logged days', () => {
    const domain = resolveLineChartYDomainFromSeries([[49, null, 160]]);
    const points = buildIndexedLineChartPoints({
      values: [49, null, 160],
      width: 300,
      height: 180,
      padding: 16,
      domain,
    });

    assert.equal(points.length, 2);
    assert.equal(points[0]!.x, 16);
    assert.equal(points[1]!.x, 284);
  });
});

describe('pointsToMonotoneXPath', () => {
  it('does not overshoot between 49 g and 160 g (no dip below the lower point)', () => {
    const domain = resolveLineChartYDomain({ values: [49, 160, 50] });
    const points = buildLineChartPoints({
      values: [49, 160, 50],
      width: 300,
      height: 180,
      padding: 16,
    });
    const segments = buildMonotoneXCubicSegments(points);
    assert.equal(segments.length, 2);

    const yMin = valueToChartY({
      value: 160,
      min: domain.min,
      range: domain.range,
      height: 180,
      padding: 16,
    });
    const yMax = valueToChartY({
      value: 49,
      min: domain.min,
      range: domain.range,
      height: 180,
      padding: 16,
    });

    for (const segment of segments) {
      const lo = Math.min(segment.from.y, segment.to.y);
      const hi = Math.max(segment.from.y, segment.to.y);
      for (let step = 0; step <= 20; step += 1) {
        const y = sampleCubicSegmentY(segment, step / 20);
        assert.ok(y + 1e-9 >= lo);
        assert.ok(y - 1e-9 <= hi);
        assert.ok(y + 1e-9 >= yMin);
        assert.ok(y - 1e-9 <= yMax);
      }
    }

    const path = pointsToMonotoneXPath(points);
    assert.match(path, /^M /);
    assert.match(path, / C /);
  });
});
