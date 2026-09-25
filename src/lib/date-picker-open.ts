/**
 * The date a picker shows when it opens is the chosen date: iOS only reports
 * a change after the wheel turned, so "Fertig" without turning would keep
 * nothing although a date is on screen.
 */
export function dateOnPickerOpen(current: Date | null | undefined, shown: Date): Date {
  return current ?? shown;
}
