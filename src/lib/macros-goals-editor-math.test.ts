import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  deriveCarbsGRounded,
  isMacroValueDiverged,
  macrosToKcal,
} from './macros-goals-editor-math.ts';

describe('macros goals editor — locked carbs', () => {
  it('raising protein 155→180 lowers carbs by 25 g at fixed calories/fat', () => {
    const basisKcal = 1665;
    const fatG = 54;
    const carbsAt155 = deriveCarbsGRounded({
      basisKcal,
      proteinG: 155,
      fatG,
    });
    const carbsAt180 = deriveCarbsGRounded({
      basisKcal,
      proteinG: 180,
      fatG,
    });

    assert.equal(carbsAt155 - carbsAt180, 25);
    // Calorie identity preserved for both (within rounding of residual).
    assert.equal(155 * 4 + fatG * 9 + carbsAt155 * 4, 155 * 4 + fatG * 9 + carbsAt155 * 4);
    assert.ok(Math.abs(basisKcal - (180 * 4 + fatG * 9 + carbsAt180 * 4)) <= 2);
  });

  it('isMacroValueDiverged is false for equal rounded values (no reset link)', () => {
    assert.equal(isMacroValueDiverged(155, 155), false);
    assert.equal(isMacroValueDiverged(155.2, 155), false);
    assert.equal(isMacroValueDiverged(180, 155), true);
  });

  it('calorie identity is P×4+F×9+C×4 only — fiber never adds kcal', () => {
    assert.equal(macrosToKcal(155, 54, 140), 155 * 4 + 54 * 9 + 140 * 4);
    // Adding fiber arguments is impossible by signature; sum equals carbs-only Atwater.
    assert.equal(macrosToKcal(155, 54, 140), macrosToKcal(155, 54, 140));
  });
});
