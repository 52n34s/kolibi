/** Display-only calorie formatting — does not mutate stored values. */
export function formatKcal(value: number): string {
  return Math.round(value).toString();
}
