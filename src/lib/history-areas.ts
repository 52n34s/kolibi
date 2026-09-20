export type HistoryContentArea = 'nutrition' | 'body' | 'training';

const AREA_ORDER: HistoryContentArea[] = ['nutrition', 'body', 'training'];

export function resolveVisibleHistoryAreas(hasContent: {
  nutrition: boolean;
  body: boolean;
  training: boolean;
}): HistoryContentArea[] {
  return AREA_ORDER.filter((area) => hasContent[area]);
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
