/**
 * Scroll offset that brings the end of the content (the "Satz fertig" button)
 * fully above a bar overlaying the bottom of the scroll view, or null when it
 * is visible already. All values in points.
 */
export function revealScrollOffset(params: {
  /** Content height including the bottom padding. */
  contentHeight: number;
  viewportHeight: number;
  scrollY: number;
  /** Height of the overlay at the bottom (0 when hidden). */
  overlayHeight: number;
  /** Space below the target inside the content (the padding under it). */
  paddingBelowTarget: number;
  /** Air between the target and the overlay. */
  margin?: number;
}): number | null {
  const margin = params.margin ?? 8;
  const targetBottom = params.contentHeight - params.paddingBelowTarget;
  const visibleBottom = params.scrollY + params.viewportHeight - params.overlayHeight;
  if (targetBottom + margin <= visibleBottom) {
    return null;
  }
  const maxOffset = Math.max(0, params.contentHeight - params.viewportHeight);
  return Math.min(maxOffset, targetBottom + margin - (params.viewportHeight - params.overlayHeight));
}
