import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  MacroEmpfehlungsZiel,
  MacroErnaehrungsform,
  computeEmpfohleneMakros,
  resolveProteinBezugsgewicht,
  type EmpfohleneMakrosInput,
} from './macro-recommendations.ts';
import {
  PROTEIN_PER_KG_FALLBACK,
  resolveProteinBezug,
  resolveProteinPerKgBase,
} from './macro-rules.ts';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SNAPSHOT_PATH = join(__dirname, '__snapshots__/macro-recommendations.snap.json');

type SnapshotCase = {
  protein: { wert: number; herleitung: string; details: Record<string, unknown> };
  fett: { wert: number; herleitung: string; details: Record<string, unknown> };
  kohlenhydrate: { wert: number; herleitung: string; details: Record<string, unknown> };
  ballaststoffe: { wert: number; herleitung: string; details: Record<string, unknown> };
  proteinBezugsgewichtKg: number;
  proteinBezugIstZielgewicht: boolean;
  bmi: number;
};

type SnapshotFile = {
  bmi24: {
    profile: EmpfohleneMakrosInput;
    bezug: {
      bmi: number;
      istZielgewicht: boolean;
      zielFloorAngewendet: boolean;
      bezugsgewichtKg: number;
    };
    cases: Record<string, SnapshotCase>;
  };
  bmi29: {
    profile: EmpfohleneMakrosInput;
    bezug: {
      bmi: number;
      istZielgewicht: boolean;
      zielFloorAngewendet: boolean;
      bezugsgewichtKg: number;
    };
    cases: Record<string, SnapshotCase>;
  };
  /** Current weight wins when it is the continuous min() pick. */
  bmi24CurrentWins: {
    profile: EmpfohleneMakrosInput;
    bezug: {
      bmi: number;
      istZielgewicht: boolean;
      zielFloorAngewendet: boolean;
      bezugsgewichtKg: number;
    };
  };
};

const snapshot = JSON.parse(readFileSync(SNAPSHOT_PATH, 'utf8')) as SnapshotFile;

const ZIELE = Object.values(MacroEmpfehlungsZiel);
const DIETS = Object.values(MacroErnaehrungsform);

function roundBmi(bmi: number): number {
  return Math.round(bmi * 1000) / 1000;
}

function serializeCase(input: EmpfohleneMakrosInput) {
  const result = computeEmpfohleneMakros(input);
  return {
    protein: result.protein,
    fett: result.fett,
    kohlenhydrate: result.kohlenhydrate,
    ballaststoffe: result.ballaststoffe,
    proteinBezugsgewichtKg: result.proteinBezugsgewichtKg,
    proteinBezugIstZielgewicht: result.proteinBezugIstZielgewicht,
    bmi: roundBmi(result.bmi),
  };
}

describe('resolveProteinPerKgBase fallback', () => {
  it(`goal_type null, no TDEE → ${PROTEIN_PER_KG_FALLBACK}`, () => {
    assert.equal(
      resolveProteinPerKgBase({
        goalType: null,
        dailyCalorieGoal: 2000,
        tdee: null,
      }),
      1.6,
    );
    assert.equal(PROTEIN_PER_KG_FALLBACK, 1.6);
  });
});

describe('resolveProteinBezug BMI-20 target floor', () => {
  it('Floor greift: 95 kg, 180 cm, Ziel unter BMI-20 → Bezug 64.8', () => {
    // At 180 cm, BMI-20 mass = 64.8. Ziel 70 is already above the floor
    // (bezug stays 70). Floor raises only when Ziel < 64.8 — e.g. Ziel 60.
    const floorCase = resolveProteinBezug({
      weightKg: 95,
      heightCm: 180,
      targetWeightKg: 60,
    });
    assert.equal(floorCase.bezugsgewichtKg, 64.8);
    assert.equal(floorCase.zielFloorAngewendet, true);
    assert.equal(floorCase.istZielgewicht, false);

    const ziel70 = resolveProteinBezug({
      weightKg: 95,
      heightCm: 180,
      targetWeightKg: 70,
    });
    assert.equal(ziel70.bezugsgewichtKg, 70);
    assert.equal(ziel70.zielFloorAngewendet, false);
    assert.equal(ziel70.istZielgewicht, true);
  });

  it('Floor greift nicht: 88 kg, 180 cm, Ziel 77 → Bezug 77', () => {
    const bezug = resolveProteinBezug({
      weightKg: 88,
      heightCm: 180,
      targetWeightKg: 77,
    });
    assert.equal(bezug.bezugsgewichtKg, 77);
    assert.equal(bezug.zielFloorAngewendet, false);
    assert.equal(bezug.istZielgewicht, true);
  });

  it('Untergewicht: 55 kg, 180 cm, Ziel 55 → Bezug 55, nicht 64.8', () => {
    const bezug = resolveProteinBezug({
      weightKg: 55,
      heightCm: 180,
      targetWeightKg: 55,
    });
    assert.equal(bezug.bezugsgewichtKg, 55);
    assert.equal(bezug.zielFloorAngewendet, false);
    assert.equal(bezug.istZielgewicht, false);
    assert.equal(bezug.kind, 'current');
  });
});

describe('resolveProteinBezugsgewicht (min of current, BMI-25, floored target)', () => {
  it('BMI 24 lose-target: picks target (lowest of 73.5 / BMI-25 / 70)', () => {
    const p = snapshot.bmi24.profile;
    const bezug = resolveProteinBezugsgewicht(p);
    assert.equal(roundBmi(bezug.bmi), 24);
    assert.equal(bezug.istZielgewicht, true);
    assert.equal(bezug.zielFloorAngewendet, false);
    assert.equal(bezug.bezugsgewichtKg, p.zielgewichtKg);
    assert.equal(bezug.bezugsgewichtKg, snapshot.bmi24.bezug.bezugsgewichtKg);
  });

  it('BMI 29: picks target (lowest of current / BMI-25 / target)', () => {
    const p = snapshot.bmi29.profile;
    const bezug = resolveProteinBezugsgewicht(p);
    assert.equal(roundBmi(bezug.bmi), 29);
    assert.equal(bezug.istZielgewicht, true);
    assert.equal(bezug.zielFloorAngewendet, false);
    assert.equal(bezug.bezugsgewichtKg, p.zielgewichtKg);
    assert.equal(bezug.bezugsgewichtKg, snapshot.bmi29.bezug.bezugsgewichtKg);
  });

  it('uses current weight when it is the continuous min()', () => {
    const p = snapshot.bmi24CurrentWins.profile;
    const bezug = resolveProteinBezugsgewicht(p);
    assert.equal(roundBmi(bezug.bmi), 24);
    assert.equal(bezug.istZielgewicht, false);
    assert.equal(bezug.zielFloorAngewendet, false);
    assert.equal(bezug.bezugsgewichtKg, p.gewichtKg);
    assert.equal(bezug.bezugsgewichtKg, snapshot.bmi24CurrentWins.bezug.bezugsgewichtKg);
  });
});

describe('computeEmpfohleneMakros snapshots — BMI 24 × 4 Ziele × 3 Ernährungsformen', () => {
  const profile = snapshot.bmi24.profile;

  for (const ziel of ZIELE) {
    for (const diet of DIETS) {
      const key = `${ziel}__${diet}`;
      it(key, () => {
        const actual = serializeCase({
          ...profile,
          ziel,
          ernaehrungsform: diet,
        });
        assert.deepEqual(actual, snapshot.bmi24.cases[key]);
        assert.equal(actual.proteinBezugIstZielgewicht, true);
        assert.equal(actual.proteinBezugsgewichtKg, profile.zielgewichtKg);
        assert.match(actual.protein.herleitung, /Zielgewicht/);
      });
    }
  }
});

describe('computeEmpfohleneMakros snapshots — BMI 29 × 4 Ziele × 3 Ernährungsformen', () => {
  const profile = snapshot.bmi29.profile;

  for (const ziel of ZIELE) {
    for (const diet of DIETS) {
      const key = `${ziel}__${diet}`;
      it(key, () => {
        const actual = serializeCase({
          ...profile,
          ziel,
          ernaehrungsform: diet,
        });
        assert.deepEqual(actual, snapshot.bmi29.cases[key]);
        assert.equal(actual.proteinBezugIstZielgewicht, true);
        assert.equal(actual.proteinBezugsgewichtKg, profile.zielgewichtKg);
        assert.match(actual.protein.herleitung, /Zielgewicht/);
      });
    }
  }
});

describe('derivation examples', () => {
  it('matches the vegan lose-weight style herleitung on BMI 29 (target weight)', () => {
    const result = computeEmpfohleneMakros({
      ...snapshot.bmi29.profile,
      ziel: MacroEmpfehlungsZiel.ABNEHMEN,
      ernaehrungsform: MacroErnaehrungsform.VEGAN,
    });
    assert.equal(result.protein.wert, 151);
    assert.equal(result.protein.herleitung, '1,8 g pro kg Zielgewicht · +12 % pflanzlich');
    assert.equal(result.protein.details.bezugsart, 'zielgewicht');
    assert.equal(result.protein.details.dietUpliftPercent, 12);
  });

  it('uses BMI-20-Gewicht in herleitung when the target floor raises the candidate', () => {
    const result = computeEmpfohleneMakros({
      ziel: MacroEmpfehlungsZiel.ABNEHMEN,
      ernaehrungsform: MacroErnaehrungsform.OMNIVOR,
      gewichtKg: 95,
      zielgewichtKg: 60,
      groesseCm: 180,
      basisKcal: 2000,
    });
    assert.equal(result.proteinBezugsgewichtKg, 64.8);
    assert.equal(result.proteinBezugIstZielgewicht, false);
    assert.equal(result.protein.details.bezugsart, 'bmi20_floor');
    assert.equal(result.protein.details.zielFloorAngewendet, true);
    assert.equal(result.protein.herleitung, '1,8 g pro kg BMI-20-Gewicht');
    assert.equal(result.protein.wert, Math.round(1.8 * 64.8));
  });
});
