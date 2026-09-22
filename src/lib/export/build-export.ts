import type {
  ExportData,
  ExportLabels,
  ExportMacroPair,
  ExportNutritionDay,
  ExportOptions,
} from './types.ts';

function fmtNum(value: number | null | undefined, missing: string, digits = 0): string {
  if (value == null || !Number.isFinite(value)) {
    return missing;
  }
  if (digits === 0) {
    return String(Math.round(value));
  }
  const rounded = Math.round(value * 10 ** digits) / 10 ** digits;
  return String(rounded);
}

function fmtPair(pair: ExportMacroPair, missing: string): string {
  return `${fmtNum(pair.actual, missing)}/${fmtNum(pair.goal, missing)}`;
}

function hasContextContent(data: ExportData): boolean {
  const c = data.context;
  return (
    c.goalTypeLabel != null ||
    c.currentWeightKg != null ||
    c.startWeightKg != null ||
    c.targetWeightKg != null ||
    c.calorieGoal != null ||
    c.proteinG != null ||
    c.carbsG != null ||
    c.fatG != null ||
    c.fiberG != null ||
    c.dietLabel != null ||
    c.movementGoalLabel != null ||
    c.trainingSessionsPerWeek != null ||
    c.templates.length > 0
  );
}

function hasNutritionContent(data: ExportData): boolean {
  return data.nutritionDays.some(
    (day) =>
      day.meals.length > 0 ||
      day.totalKcal != null ||
      day.goalKcal != null ||
      day.burnedKcal != null,
  );
}

function hasTrainingContent(data: ExportData): boolean {
  return (
    data.workoutSessions.length > 0 ||
    data.manualSessions.length > 0 ||
    data.runningDays.length > 0
  );
}

function hasBodyContent(data: ExportData): boolean {
  return data.weightEntries.length > 0;
}

function formatRangeLabel(startKey: string, endKey: string, lang: string): string {
  const start = parseLocal(startKey);
  const end = parseLocal(endKey);
  const opts: Intl.DateTimeFormatOptions = { day: '2-digit', month: '2-digit', year: 'numeric' };
  if (startKey === endKey) {
    return start.toLocaleDateString(lang, opts);
  }
  return `${start.toLocaleDateString(lang, opts)}–${end.toLocaleDateString(lang, opts)}`;
}

function parseLocal(key: string): Date {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y ?? 0, (m ?? 1) - 1, d ?? 1);
}

function formatDayTotals(day: ExportNutritionDay, labels: ExportLabels): string {
  const missing = labels.missing;
  const burned =
    day.burnedKcal != null && day.burnedKcal > 0
      ? ` ${labels.burned.replace('{{kcal}}', fmtNum(day.burnedKcal, missing))}`
      : '';
  return labels.dayTotals
    .replace('{{actual}}', fmtNum(day.totalKcal, missing))
    .replace('{{goal}}', fmtNum(day.goalKcal, missing))
    .replace('{{burned}}', burned)
    .replace('{{protein}}', fmtPair(day.protein, missing))
    .replace('{{carbs}}', fmtPair(day.carbs, missing))
    .replace('{{fat}}', fmtPair(day.fat, missing))
    .replace('{{fiber}}', fmtPair(day.fiber, missing));
}

function buildContextSection(data: ExportData, labels: ExportLabels): string[] {
  const lines: string[] = [`## ${labels.context}`, ''];
  const c = data.context;
  const m = labels.missing;

  if (c.goalTypeLabel) {
    lines.push(`- ${labels.goalType}: ${c.goalTypeLabel}`);
  }
  lines.push(
    `- ${labels.weight}: ${labels.weightCurrent} ${fmtNum(c.currentWeightKg, m, 1)} ${labels.kg} · ${labels.weightStart} ${fmtNum(c.startWeightKg, m, 1)} ${labels.kg} · ${labels.weightTarget} ${fmtNum(c.targetWeightKg, m, 1)} ${labels.kg}`,
  );
  lines.push(`- ${labels.calorieGoal}: ${fmtNum(c.calorieGoal, m)} ${labels.kcal}`);
  lines.push(
    `- ${labels.macros}: ${labels.protein} ${fmtNum(c.proteinG, m)} · ${labels.carbs} ${fmtNum(c.carbsG, m)} · ${labels.fat} ${fmtNum(c.fatG, m)} · ${labels.fiber} ${fmtNum(c.fiberG, m)}`,
  );
  if (c.dietLabel) {
    lines.push(`- ${labels.diet}: ${c.dietLabel}`);
  }
  if (c.trainingSessionsPerWeek != null || c.templates.length > 0) {
    lines.push(
      `- ${labels.trainingPlan}${
        c.trainingSessionsPerWeek != null
          ? `: ${labels.trainingPlanSessions.replace('{{count}}', String(c.trainingSessionsPerWeek))}`
          : ''
      }`,
    );
    for (const template of c.templates) {
      lines.push(
        `  - ${template.shortLabel} · ${template.name} (${template.weekdaysLabel})`,
      );
      for (const exercise of template.exercises) {
        lines.push(`    - ${exercise.name}: ${exercise.target}`);
      }
    }
  }
  if (c.movementGoalLabel) {
    lines.push(`- ${labels.movementGoal}: ${c.movementGoalLabel}`);
  }
  lines.push('');
  return lines;
}

function buildNutritionSection(data: ExportData, labels: ExportLabels): string[] {
  const lines: string[] = [`## ${labels.nutrition}`, ''];
  for (const day of data.nutritionDays) {
    if (
      day.meals.length === 0 &&
      day.totalKcal == null &&
      day.goalKcal == null &&
      day.burnedKcal == null
    ) {
      continue;
    }
    lines.push(`### ${day.dateLabel}`);
    lines.push(formatDayTotals(day, labels));
    for (const meal of day.meals) {
      const items = meal.items
        .map((item) =>
          labels.itemAmount
            .replace('{{name}}', item.name)
            .replace('{{amount}}', item.amountLabel)
            .replace('{{kcal}}', fmtNum(item.kcal, labels.missing)),
        )
        .join(', ');
      lines.push(
        labels.mealLine.replace('{{time}}', meal.timeLabel).replace('{{items}}', items),
      );
    }
    lines.push('');
  }
  return lines;
}

function buildTrainingSection(data: ExportData, labels: ExportLabels): string[] {
  const lines: string[] = [`## ${labels.training}`, ''];

  for (const session of data.workoutSessions) {
    const duration =
      session.durationMin != null
        ? labels.minutes.replace('{{n}}', String(session.durationMin))
        : labels.missing;
    const intensity = session.intensityLabel ?? labels.missing;
    lines.push(
      labels.sessionHeading
        .replace('{{date}}', session.dateLabel)
        .replace('{{name}}', session.name)
        .replace('{{duration}}', duration)
        .replace('{{intensity}}', intensity),
    );
    if (session.rows.length > 0) {
      lines.push(
        `| ${labels.tableExercise} | ${labels.tableTarget} | ${labels.tableActual} |`,
      );
      lines.push('| --- | --- | --- |');
      for (const row of session.rows) {
        lines.push(`| ${row.exercise} | ${row.target} | ${row.actual} |`);
      }
    }
    lines.push('');
  }

  if (data.manualSessions.length > 0) {
    lines.push(`### ${labels.manualTraining}`);
    for (const row of data.manualSessions) {
      lines.push(
        `- ${row.dateLabel}: ${row.activityLabel} · ${labels.minutes.replace('{{n}}', String(row.durationMin))} · ${row.intensityLabel}`,
      );
    }
    lines.push('');
  }

  if (data.runningDays.length > 0) {
    lines.push(`### ${labels.runningKm}`);
    for (const row of data.runningDays) {
      lines.push(`- ${row.dateLabel}: ${fmtNum(row.km, labels.missing, 1)} km`);
    }
    lines.push('');
  }

  return lines;
}

function buildBodySection(data: ExportData, labels: ExportLabels): string[] {
  const lines: string[] = [`## ${labels.body}`, ''];
  for (const entry of data.weightEntries) {
    lines.push(
      labels.weightEntry
        .replace('{{date}}', entry.dateLabel)
        .replace('{{kg}}', fmtNum(entry.weightKg, labels.missing, 1)),
    );
  }
  lines.push('');
  return lines;
}

/**
 * Pure markdown builder. All copy comes from `labels` (i18n); `lang` is for the date range only.
 */
export function buildExportMarkdown(
  data: ExportData,
  options: ExportOptions,
  lang: string,
  labels: ExportLabels,
): string {
  const lines: string[] = [
    `# ${labels.title} · ${formatRangeLabel(options.startKey, options.endKey, lang)}`,
    '',
  ];

  if (hasContextContent(data)) {
    lines.push(...buildContextSection(data, labels));
  }

  if (options.sections.nutrition && hasNutritionContent(data)) {
    lines.push(...buildNutritionSection(data, labels));
  }

  if (options.sections.training && hasTrainingContent(data)) {
    lines.push(...buildTrainingSection(data, labels));
  }

  if (options.sections.body && hasBodyContent(data)) {
    lines.push(...buildBodySection(data, labels));
  }

  if (options.includeQuestion) {
    lines.push(`## ${labels.questionHeading}`, '', labels.questionBody, '');
  }

  return lines.join('\n').trimEnd() + '\n';
}
