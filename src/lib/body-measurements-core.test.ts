import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  daysSinceLastMeasurement,
  measurementCmToDraft,
  parseMeasurementInputToCm,
  usesMeasurements,
} from './body-measurements-core.ts';

const empty = { chest_cm: null, arm_cm: null, hip_cm: null, thigh_cm: null };

describe('parseMeasurementInputToCm', () => {
  it('treats an empty field as no value', () => {
    assert.deepEqual(parseMeasurementInputToCm({ field: 'chest', value: '  ', unitSystem: 'metric' }), {
      ok: true,
      cm: null,
    });
  });

  it('reads comma decimals in cm', () => {
    assert.deepEqual(
      parseMeasurementInputToCm({ field: 'arm', value: '35,25', unitSystem: 'metric' }),
      { ok: true, cm: 35.3 },
    );
  });

  it('converts inches to cm', () => {
    assert.deepEqual(
      parseMeasurementInputToCm({ field: 'chest', value: '40', unitSystem: 'imperial' }),
      { ok: true, cm: 101.6 },
    );
  });

  it('rejects values outside the field range', () => {
    assert.deepEqual(parseMeasurementInputToCm({ field: 'arm', value: '120', unitSystem: 'metric' }), {
      ok: false,
    });
    assert.deepEqual(parseMeasurementInputToCm({ field: 'waist', value: '30', unitSystem: 'metric' }), {
      ok: false,
    });
    assert.deepEqual(parseMeasurementInputToCm({ field: 'thigh', value: 'abc', unitSystem: 'metric' }), {
      ok: false,
    });
  });
});

describe('measurementCmToDraft', () => {
  it('prefills cm or inches', () => {
    assert.equal(measurementCmToDraft(101.6, 'metric'), '101.6');
    assert.equal(measurementCmToDraft(101.6, 'imperial'), '40');
    assert.equal(measurementCmToDraft(null, 'metric'), '');
  });
});

describe('usesMeasurements', () => {
  it('is false without rows or with empty rows', () => {
    assert.equal(usesMeasurements([]), false);
    assert.equal(usesMeasurements([empty]), false);
  });

  it('is true once any circumference is stored', () => {
    assert.equal(usesMeasurements([empty, { ...empty, thigh_cm: 55 }]), true);
  });
});

describe('daysSinceLastMeasurement', () => {
  it('is null without measurements', () => {
    assert.equal(daysSinceLastMeasurement({ measuredOn: [], todayKey: '2026-09-25' }), null);
  });

  it('counts calendar days from the latest day', () => {
    assert.equal(
      daysSinceLastMeasurement({
        measuredOn: ['2026-09-01', '2026-09-11', '2026-08-20'],
        todayKey: '2026-09-25',
      }),
      14,
    );
  });

  it('is 0 for today and ignores future or malformed days', () => {
    assert.equal(
      daysSinceLastMeasurement({
        measuredOn: ['2026-09-25', '2026-10-01', 'nope'],
        todayKey: '2026-09-25',
      }),
      0,
    );
  });

  it('crosses the DST switch without off-by-one', () => {
    assert.equal(
      daysSinceLastMeasurement({ measuredOn: ['2026-10-20'], todayKey: '2026-11-03' }),
      14,
    );
  });
});
