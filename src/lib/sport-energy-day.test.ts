import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { SportIntensity } from './sport-macro-scaling.ts';
import { buildSportEnergyDay, resolveSportKcalForHistory } from './sport-energy-day.ts';

describe('resolveSportKcalForHistory', () => {
  it('prefers the stored sport energy over Active Energy', () => {
    assert.equal(
      resolveSportKcalForHistory({ sportEnergyKcal: 780, activeEnergyKcal: 500 }),
      780,
    );
  });

  it('falls back to Active Energy when nothing was stored', () => {
    assert.equal(resolveSportKcalForHistory({ sportEnergyKcal: null, activeEnergyKcal: 500 }), 500);
    assert.equal(
      resolveSportKcalForHistory({ sportEnergyKcal: undefined, activeEnergyKcal: 500 }),
      500,
    );
  });

  it('a stored zero is a real day without movement', () => {
    assert.equal(resolveSportKcalForHistory({ sportEnergyKcal: 0, activeEnergyKcal: 500 }), 0);
  });

  it('unknown stays unknown', () => {
    assert.equal(resolveSportKcalForHistory({ sportEnergyKcal: null, activeEnergyKcal: null }), null);
    assert.equal(
      resolveSportKcalForHistory({ sportEnergyKcal: Number.NaN, activeEnergyKcal: -5 }),
      null,
    );
  });
});

/**
 * Locks totalActiveKcal to the pre-breakdown formula:
 * activeEnergy + non-suppressed training_sessions (when sessionsPerWeek ≥ 1).
 */
describe('buildSportEnergyDay totalActiveKcal', () => {
  it('only Active Energy (no workouts, no training)', () => {
    const day = buildSportEnergyDay({
      activeEnergyKcal: 513,
      workouts: [],
      trainingSessions: [],
      sessionsPerWeek: 3,
      baselineLabel: 'Alltagsbewegung',
    });

    assert.equal(day.totalActiveKcal, 513);
    assert.equal(day.breakdown.length, 1);
    assert.equal(day.breakdown[0]?.kind, 'baseline');
    assert.equal(day.breakdown[0]?.kcal, 513);
    assert.equal(day.breakdown[0]?.counted, true);
  });

  it('AE plus two HealthKit workouts', () => {
    const day = buildSportEnergyDay({
      activeEnergyKcal: 800,
      workouts: [
        {
          activityType: 37,
          kcal: 300,
          intensity: SportIntensity.MODERATE,
          label: 'Laufen',
        },
        {
          activityType: 50,
          kcal: 200,
          intensity: SportIntensity.MODERATE,
          label: 'Krafttraining',
        },
      ],
      trainingSessions: [],
      sessionsPerWeek: 3,
      baselineLabel: 'Alltagsbewegung',
    });

    // residual = 800 - 500 = 300; total stays AE (no training add)
    assert.equal(day.totalActiveKcal, 800);
    assert.equal(
      day.breakdown.filter((b) => b.counted).reduce((s, b) => s + b.kcal, 0),
      800,
    );
    assert.equal(day.breakdown.filter((b) => b.kind === 'hk_workout').length, 2);
    assert.equal(day.breakdown.find((b) => b.kind === 'baseline')?.kcal, 300);
  });

  it('AE plus workout plus deduplicated training_session', () => {
    const day = buildSportEnergyDay({
      activeEnergyKcal: 600,
      workouts: [
        {
          activityType: 50, // traditionalStrengthTraining
          kcal: 250,
          intensity: SportIntensity.MODERATE,
          label: 'Krafttraining',
        },
      ],
      trainingSessions: [
        {
          activity: 'strength',
          kcal: 329,
          intensity: SportIntensity.MODERATE,
          label: 'Push',
          shortLabel: 'P',
          colorKey: 'indigo',
        },
      ],
      sessionsPerWeek: 3,
      baselineLabel: 'Alltagsbewegung',
    });

    // Strength HK present → training suppressed; total = AE only
    assert.equal(day.totalActiveKcal, 600);
    const suppressed = day.breakdown.find((b) => b.kind === 'training_session');
    assert.ok(suppressed);
    assert.equal(suppressed!.counted, false);
    assert.equal(suppressed!.suppressedBy, 'healthkit');
    assert.equal(suppressed!.kcal, 329);
    // Suppressed kcal must not appear in segments
    assert.ok(!day.segments.some((s) => s.kcal === 329));
  });

  it('AE plus non-deduplicated training_session', () => {
    const day = buildSportEnergyDay({
      activeEnergyKcal: 400,
      workouts: [
        {
          activityType: 37, // running — does not match strength
          kcal: 200,
          intensity: SportIntensity.HIGH,
          label: 'Laufen',
        },
      ],
      trainingSessions: [
        {
          activity: 'strength',
          kcal: 280,
          intensity: SportIntensity.MODERATE,
          label: 'Krafttraining',
        },
      ],
      sessionsPerWeek: 3,
      baselineLabel: 'Alltagsbewegung',
    });

    assert.equal(day.totalActiveKcal, 400 + 280);
    const training = day.breakdown.find((b) => b.kind === 'training_session');
    assert.ok(training);
    assert.equal(training!.counted, true);
    assert.equal(training!.suppressedBy, undefined);
    assert.ok(day.segments.some((s) => s.kcal === 280));
  });

  it('training_sessions_per_week null excludes all training_sessions', () => {
    const day = buildSportEnergyDay({
      activeEnergyKcal: 450,
      workouts: [],
      trainingSessions: [
        {
          activity: 'cycling',
          kcal: 500,
          intensity: SportIntensity.MODERATE,
          label: 'Radfahren',
        },
      ],
      sessionsPerWeek: null,
      baselineLabel: 'Alltagsbewegung',
    });

    assert.equal(day.totalActiveKcal, 450);
    assert.equal(
      day.breakdown.filter((b) => b.kind === 'training_session').length,
      0,
    );
  });
});
