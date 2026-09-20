/** Center camera button diameter (`ScanMealButton`). */
export const SCAN_MEAL_BUTTON_SIZE = 80;

/** `mt-3` under each scan-bar control. */
export const SCAN_BUTTON_LABEL_GAP = 12;

/** `text-sm` line height of the captions under the buttons. */
export const SCAN_BUTTON_LABEL_LINE_HEIGHT = 20;

/**
 * Overlay cluster height: camera button + caption.
 * Side buttons are shorter and sit on the same baseline.
 */
export const SCAN_BUTTON_BAR_HEIGHT =
  SCAN_MEAL_BUTTON_SIZE + SCAN_BUTTON_LABEL_GAP + SCAN_BUTTON_LABEL_LINE_HEIGHT;

/** Offset from the bottom of the overlay parent (`bottom-8`). */
export const SCAN_BUTTON_BAR_GAP = 32;

/** Scroll padding so content can clear the absolutely positioned scan bar. */
export function scanButtonBarScrollPadding(bottomInset: number): number {
  return SCAN_BUTTON_BAR_HEIGHT + SCAN_BUTTON_BAR_GAP + bottomInset;
}
