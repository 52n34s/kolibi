/**
 * True when starter-plan / template-save may set training_sessions_per_week.
 * null and 0 both mean "no real goal yet" (0 is not a valid weekly target).
 */
export function shouldSeedWeeklyGoal(currentGoal: number | null | undefined): boolean {
  return currentGoal == null || !(currentGoal >= 1);
}
