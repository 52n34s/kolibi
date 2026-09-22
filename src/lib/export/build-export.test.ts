import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { buildExportMarkdown } from './build-export.ts';
import type { ExportData, ExportLabels, ExportOptions } from './types.ts';

const labels: ExportLabels = {
  title: 'Kolibi-Export',
  context: 'Kontext',
  nutrition: 'Ernährung',
  training: 'Training',
  body: 'Körper',
  questionHeading: 'Frage',
  questionBody:
    'Bitte werte meinen Zeitraum aus: Fortschritt, Auffälligkeiten, konkrete nächste Schritte für Training und Ernährung.',
  missing: '–',
  goalType: 'Ziel',
  weight: 'Gewicht',
  weightCurrent: 'aktuell',
  weightStart: 'Start',
  weightTarget: 'Ziel',
  calorieGoal: 'Kalorienziel',
  macros: 'Makros',
  diet: 'Diät',
  trainingPlan: 'Trainingsplan',
  trainingPlanSessions: '{{count}}/Woche',
  trainingPlanRotating: 'Wechsel',
  movementGoal: 'Bewegungsziel',
  burned: '+ {{kcal}} verbrannt',
  runningKm: 'Lauf-km',
  manualTraining: 'Manuell',
  tableExercise: 'Übung',
  tableTarget: 'Ziel',
  tableActual: 'Ist',
  dayTotals:
    'Gesamt: {{actual}} kcal (Ziel {{goal}}{{burned}}) · P {{protein}} · K {{carbs}} · F {{fat}} · Bst {{fiber}}',
  mealLine: '- {{time}}: {{items}}',
  itemAmount: '{{name}} {{amount}} ({{kcal}} kcal)',
  sessionHeading: '### {{date}} · {{name}} · {{duration}} · {{intensity}}',
  weightEntry: '- {{date}}: {{kg}} kg',
  kg: 'kg',
  kcal: 'kcal',
  minutes: '{{n}} min',
  protein: 'P',
  carbs: 'K',
  fat: 'F',
  fiber: 'Bst',
};

function baseOptions(partial: Partial<ExportOptions> = {}): ExportOptions {
  return {
    days: 1,
    sections: { nutrition: true, training: true, body: true },
    includeQuestion: false,
    startKey: '2026-09-22',
    endKey: '2026-09-22',
    ...partial,
  };
}

function emptyData(partial: Partial<ExportData> = {}): ExportData {
  return {
    context: {
      goalTypeLabel: null,
      currentWeightKg: null,
      startWeightKg: null,
      targetWeightKg: null,
      calorieGoal: null,
      proteinG: null,
      carbsG: null,
      fatG: null,
      fiberG: null,
      dietLabel: null,
      movementGoalLabel: null,
      trainingSessionsPerWeek: null,
      templates: [],
    },
    nutritionDays: [],
    workoutSessions: [],
    manualSessions: [],
    runningDays: [],
    weightEntries: [],
    ...partial,
  };
}

describe('buildExportMarkdown', () => {
  it('formats a single nutrition day with meals', () => {
    const md = buildExportMarkdown(
      emptyData({
        context: {
          ...emptyData().context,
          goalTypeLabel: 'Abnehmen',
          calorieGoal: 1666,
          currentWeightKg: 80.5,
        },
        nutritionDays: [
          {
            dateKey: '2026-09-22',
            dateLabel: 'Di 22.09.',
            totalKcal: 1850,
            goalKcal: 1666,
            burnedKcal: 320,
            protein: { actual: 142, goal: 155 },
            carbs: { actual: 180, goal: 170 },
            fat: { actual: 60, goal: 54 },
            fiber: { actual: 24, goal: 30 },
            meals: [
              {
                timeLabel: '08:10',
                items: [
                  { name: 'Haferflocken', amountLabel: '60 g', kcal: 228 },
                  { name: 'Milch', amountLabel: '200 g', kcal: 128 },
                ],
              },
            ],
          },
        ],
      }),
      baseOptions({ days: 1 }),
      'de',
      labels,
    );

    assert.match(md, /# Kolibi-Export · /);
    assert.match(md, /## Kontext/);
    assert.match(md, /## Ernährung/);
    assert.match(md, /### Di 22\.09\./);
    assert.match(
      md,
      /Gesamt: 1850 kcal \(Ziel 1666 \+ 320 verbrannt\) · P 142\/155 · K 180\/170 · F 60\/54 · Bst 24\/30/,
    );
    assert.match(md, /- 08:10: Haferflocken 60 g \(228 kcal\), Milch 200 g \(128 kcal\)/);
    assert.doesNotMatch(md, /## Training/);
    assert.doesNotMatch(md, /## Körper/);
  });

  it('covers 7 days and omits empty sections', () => {
    const nutritionDays = Array.from({ length: 7 }, (_, i) => {
      const day = 16 + i;
      return {
        dateKey: `2026-09-${day}`,
        dateLabel: `Tag ${day}`,
        totalKcal: i === 0 ? 1500 : null,
        goalKcal: 1600,
        burnedKcal: null,
        protein: { actual: null, goal: 150 },
        carbs: { actual: null, goal: null },
        fat: { actual: null, goal: null },
        fiber: { actual: null, goal: null },
        meals: [] as ExportData['nutritionDays'][0]['meals'],
      };
    });

    const md = buildExportMarkdown(
      emptyData({
        nutritionDays,
        weightEntries: [{ dateLabel: 'Di 22.09.', weightKg: 80.2 }],
      }),
      baseOptions({
        days: 7,
        startKey: '2026-09-16',
        endKey: '2026-09-22',
        sections: { nutrition: true, training: true, body: true },
      }),
      'de',
      labels,
    );

    assert.match(md, /2026/);
    assert.match(md, /## Ernährung/);
    assert.match(md, /## Körper/);
    assert.doesNotMatch(md, /## Training/);
  });

  it('uses missing marker instead of 0 for absent macros', () => {
    const md = buildExportMarkdown(
      emptyData({
        nutritionDays: [
          {
            dateKey: '2026-09-22',
            dateLabel: 'Di 22.09.',
            totalKcal: 1200,
            goalKcal: 1600,
            burnedKcal: null,
            protein: { actual: null, goal: 155 },
            carbs: { actual: null, goal: null },
            fat: { actual: 40, goal: null },
            fiber: { actual: null, goal: 30 },
            meals: [],
          },
        ],
      }),
      baseOptions(),
      'de',
      labels,
    );

    assert.match(md, /P –\/155/);
    assert.match(md, /K –\/–/);
    assert.match(md, /F 40\/–/);
    assert.doesNotMatch(md, /P 0\//);
  });

  it('formats perSide time actuals and training table', () => {
    const md = buildExportMarkdown(
      emptyData({
        workoutSessions: [
          {
            dateLabel: 'Di 22.09.',
            name: 'Push',
            durationMin: 52,
            intensityLabel: 'normal',
            rows: [
              {
                exercise: 'Seitstütz',
                target: '3×30 s pro Seite',
                actual: '22 / 25 s',
              },
            ],
          },
        ],
      }),
      baseOptions({ sections: { nutrition: false, training: true, body: false } }),
      'de',
      labels,
    );

    assert.match(md, /## Training/);
    assert.match(md, /### Di 22\.09\. · Push · 52 min · normal/);
    assert.match(md, /\| Seitstütz \| 3×30 s pro Seite \| 22 \/ 25 s \|/);
    assert.doesNotMatch(md, /## Ernährung/);
  });

  it('appends question when requested and drops empty selected sections', () => {
    const md = buildExportMarkdown(
      emptyData({
        context: { ...emptyData().context, goalTypeLabel: 'Abnehmen' },
      }),
      baseOptions({
        includeQuestion: true,
        sections: { nutrition: true, training: true, body: true },
      }),
      'de',
      labels,
    );

    assert.match(md, /## Frage/);
    assert.match(md, /Bitte werte meinen Zeitraum aus/);
    assert.doesNotMatch(md, /## Ernährung/);
    assert.doesNotMatch(md, /## Training/);
    assert.doesNotMatch(md, /## Körper/);
  });
});
