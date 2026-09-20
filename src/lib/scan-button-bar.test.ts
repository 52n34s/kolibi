import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  SCAN_BUTTON_BAR_GAP,
  SCAN_BUTTON_BAR_HEIGHT,
  SCAN_MEAL_BUTTON_SIZE,
  scanButtonBarScrollPadding,
} from '../components/home/scan-button-bar.ts';

describe('scanButtonBarScrollPadding', () => {
  it('is bar height + gap + the safe-area inset, not a per-screen guess', () => {
    assert.equal(SCAN_BUTTON_BAR_HEIGHT, SCAN_MEAL_BUTTON_SIZE + 12 + 20);
    assert.equal(SCAN_BUTTON_BAR_GAP, 32);
    assert.equal(scanButtonBarScrollPadding(34), SCAN_BUTTON_BAR_HEIGHT + SCAN_BUTTON_BAR_GAP + 34);
  });
});
