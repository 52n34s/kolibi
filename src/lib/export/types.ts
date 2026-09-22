export type ExportDays = 1 | 3 | 7 | 30;

export type ExportSectionKey = 'nutrition' | 'training' | 'body';

export type ExportSections = Record<ExportSectionKey, boolean>;

export type ExportOptions = {
  days: ExportDays;
  sections: ExportSections;
  includeQuestion: boolean;
  /** Inclusive YYYY-MM-DD */
  startKey: string;
  endKey: string;
  unitSystem: 'metric' | 'imperial';
};

/** All user-visible strings for the markdown builder (from i18n). */
export type ExportLabels = {
  title: string;
  context: string;
  nutrition: string;
  training: string;
  body: string;
  questionHeading: string;
  questionBody: string;
  missing: string;
  goalType: string;
  weight: string;
  weightCurrent: string;
  weightStart: string;
  weightTarget: string;
  calorieGoal: string;
  macros: string;
  diet: string;
  trainingPlan: string;
  trainingPlanSessions: string;
  trainingPlanRotating: string;
  movementGoal: string;
  burned: string;
  runningKm: string;
  manualTraining: string;
  tableExercise: string;
  tableTarget: string;
  tableActual: string;
  /** "Gesamt: {{actual}} kcal (Ziel {{goal}}{{burned}}) · P …" */
  dayTotals: string;
  mealLine: string;
  itemAmount: string;
  sessionHeading: string;
  weightEntry: string;
  kg: string;
  kcal: string;
  minutes: string;
  protein: string;
  carbs: string;
  fat: string;
  fiber: string;
  progression: string;
  progressionOpen: string;
};

export type ExportTemplateExercise = {
  name: string;
  target: string;
};

export type ExportTemplate = {
  name: string;
  shortLabel: string;
  weekdaysLabel: string;
  exercises: ExportTemplateExercise[];
};

export type ExportContext = {
  goalTypeLabel: string | null;
  currentWeightKg: number | null;
  startWeightKg: number | null;
  targetWeightKg: number | null;
  calorieGoal: number | null;
  proteinG: number | null;
  carbsG: number | null;
  fatG: number | null;
  fiberG: number | null;
  dietLabel: string | null;
  movementGoalLabel: string | null;
  trainingSessionsPerWeek: number | null;
  templates: ExportTemplate[];
};

export type ExportMealItem = {
  name: string;
  amountLabel: string;
  kcal: number | null;
};

export type ExportMeal = {
  timeLabel: string;
  items: ExportMealItem[];
};

export type ExportMacroPair = {
  actual: number | null;
  goal: number | null;
};

export type ExportNutritionDay = {
  dateKey: string;
  dateLabel: string;
  totalKcal: number | null;
  goalKcal: number | null;
  burnedKcal: number | null;
  protein: ExportMacroPair;
  carbs: ExportMacroPair;
  fat: ExportMacroPair;
  fiber: ExportMacroPair;
  meals: ExportMeal[];
};

export type ExportWorkoutRow = {
  exercise: string;
  target: string;
  actual: string;
};

export type ExportWorkoutSession = {
  dateLabel: string;
  name: string;
  durationMin: number | null;
  intensityLabel: string | null;
  rows: ExportWorkoutRow[];
};

export type ExportManualSession = {
  dateLabel: string;
  activityLabel: string;
  durationMin: number;
  intensityLabel: string;
};

export type ExportRunningDay = {
  dateLabel: string;
  km: number;
};

export type ExportWeightEntry = {
  dateLabel: string;
  weightKg: number;
};

export type ExportProgressionEvent = {
  dateLabel: string;
  line: string;
};

export type ExportProgressionSuggestion = {
  line: string;
};

export type ExportData = {
  context: ExportContext;
  nutritionDays: ExportNutritionDay[];
  workoutSessions: ExportWorkoutSession[];
  manualSessions: ExportManualSession[];
  runningDays: ExportRunningDay[];
  weightEntries: ExportWeightEntry[];
  progressionEvents: ExportProgressionEvent[];
  progressionOpen: ExportProgressionSuggestion[];
};
