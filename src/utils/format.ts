/** Display-only calorie formatting — does not mutate stored values. */
export function formatKcal(value: number): string {
  return Math.round(value).toString();
}

/**
 * Macro grams for display: at most one decimal, in the reader's locale
 * (7,6 in de / 7.6 in en). Falls back to a plain number when Intl is missing.
 */
export function formatMacroGrams(value: number, language?: string): string {
  const rounded = Math.round(value * 10) / 10;

  try {
    return rounded.toLocaleString(language, { maximumFractionDigits: 1 });
  } catch {
    return String(rounded);
  }
}
