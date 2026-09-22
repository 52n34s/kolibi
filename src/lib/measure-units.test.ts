import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  distanceKmToDisplay,
  formatDistanceKm,
  kmToMiles,
  milesToKm,
  parseDistanceToKm,
} from './measure-units-core.ts';

describe('km ↔ mi', () => {
  it('rounds to one decimal', () => {
    assert.equal(kmToMiles(25), 15.5);
    assert.equal(milesToKm(16), 25.7);
    assert.equal(distanceKmToDisplay(20, 'metric'), 20);
    assert.equal(distanceKmToDisplay(20, 'imperial'), 12.4);
  });
});

describe('formatDistanceKm', () => {
  it('formats metric kilometers', () => {
    assert.equal(
      formatDistanceKm({
        distanceKm: 25,
        unitSystem: 'metric',
        kmLabel: 'km',
        miLabel: 'mi',
      }),
      '25 km',
    );
  });

  it('formats imperial miles', () => {
    assert.equal(
      formatDistanceKm({
        distanceKm: 25,
        unitSystem: 'imperial',
        kmLabel: 'km',
        miLabel: 'mi',
      }),
      '15.5 mi',
    );
  });
});

describe('parseDistanceToKm', () => {
  it('parses metric kilometers', () => {
    assert.equal(parseDistanceToKm({ value: '25', unitSystem: 'metric' }), 25);
    assert.equal(parseDistanceToKm({ value: '12,5', unitSystem: 'metric' }), 12.5);
  });

  it('converts imperial miles to km', () => {
    assert.equal(parseDistanceToKm({ value: '16', unitSystem: 'imperial' }), 25.7);
    assert.equal(parseDistanceToKm({ value: '12,4', unitSystem: 'imperial' }), 20);
  });

  it('returns null for empty or non-positive input', () => {
    assert.equal(parseDistanceToKm({ value: '', unitSystem: 'metric' }), null);
    assert.equal(parseDistanceToKm({ value: '0', unitSystem: 'imperial' }), null);
    assert.equal(parseDistanceToKm({ value: 'abc', unitSystem: 'metric' }), null);
  });
});
