import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  buildLineChartPoints,
  isValueInYDomain,
  resolveLineChartYDomain,
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
