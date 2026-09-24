export const workoutQueryKeys = {
  all: ['workouts'] as const,
  exercises: (userId: string) => ['workout-exercises', userId] as const,
  templates: (userId: string) => ['workout-templates', userId] as const,
  archivedTemplates: (userId: string) =>
    ['workout-templates-archived', userId] as const,
  sessionsRange: (userId: string, startKey: string, endKey: string) =>
    ['workout-sessions-range', userId, startKey, endKey] as const,
  exerciseHistory: (userId: string, exerciseId: string) =>
    ['workout-exercise-history', userId, exerciseId] as const,
  sessionDetail: (userId: string, sessionId: string) =>
    ['workout-session', userId, sessionId] as const,
  exerciseBestsBefore: (userId: string, beforeKey: string) =>
    ['workout-exercise-bests-before', userId, beforeKey] as const,
  ladder: (ladderKey: string) => ['workout-ladder', ladderKey] as const,
  progressionEvents: (userId: string) =>
    ['workout-progression-events', userId] as const,
};

/** Manual training_sessions rows (legacy logger / kcal). */
export const trainingSessionQueryKeys = {
  week: (userId: string) => ['training-sessions-week', userId] as const,
  day: (userId: string) => ['training-sessions-day', userId] as const,
  range: (userId: string) => ['training-sessions-range', userId] as const,
};
