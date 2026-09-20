export type HistoryContentArea = 'nutrition' | 'body' | 'training';

const AREA_ORDER: HistoryContentArea[] = ['nutrition', 'body', 'training'];

export function resolveVisibleHistoryAreas(hasContent: {
  nutrition: boolean;
  body: boolean;
  training: boolean;
}): HistoryContentArea[] {
  return AREA_ORDER.filter((area) => hasContent[area]);
}

/** Sessions in range, a movement goal, or Health connected. */
export function historyTrainingHasOwnContent(params: {
  hasSessionInRange: boolean;
  hasMovementGoal: boolean;
  healthConnected: boolean;
}): boolean {
  return params.hasSessionInRange || params.hasMovementGoal || params.healthConnected;
}

/**
 * Show Training when it has own content, or when Ernährung+Körper already
 * force the pill row — empty Training hitchhikes so a lone pill never appears.
 */
export function resolveHistoryTrainingVisible(params: {
  nutrition: boolean;
  body: boolean;
  hasSessionInRange: boolean;
  hasMovementGoal: boolean;
  healthConnected: boolean;
}): boolean {
  if (
    historyTrainingHasOwnContent({
      hasSessionInRange: params.hasSessionInRange,
      hasMovementGoal: params.hasMovementGoal,
      healthConnected: params.healthConnected,
    })
  ) {
    return true;
  }
  return params.nutrition && params.body;
}

/** Second pill row only when at least two areas have something to show. */
export function shouldShowHistoryAreaSwitcher(
  areas: readonly HistoryContentArea[],
): boolean {
  return areas.length >= 2;
}

export function resolveActiveHistoryArea(params: {
  selected: HistoryContentArea;
  visible: readonly HistoryContentArea[];
}): HistoryContentArea {
  if (params.visible.includes(params.selected)) {
    return params.selected;
  }
  return params.visible[0] ?? 'nutrition';
}
