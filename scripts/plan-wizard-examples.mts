/**
 * Prints the plan builder reference cases as markdown tables.
 *
 *   node --import tsx scripts/plan-wizard-examples.mts [de|en|es]
 */
import { buildPlan, formatPlanMarkdown } from '../src/lib/workouts/plan-builder.ts';
import { PLAN_BUILDER_EXAMPLES } from '../src/lib/workouts/plan-builder-examples.ts';
import { KOLIBI_TEMPLATE_PRESETS } from '../src/lib/workouts/kolibi-template-presets.ts';

const language = process.argv[2] ?? 'de';

const cases = [
  ...PLAN_BUILDER_EXAMPLES.map((example) => ({ title: example.title, answers: example.answers })),
  ...KOLIBI_TEMPLATE_PRESETS.map((preset) => ({
    title: `Preset ${preset.id}`,
    answers: preset.answers,
  })),
];

for (const { title, answers } of cases) {
  const plan = buildPlan(answers);
  console.log(`### ${title}\n`);
  console.log(`Answers: \`${JSON.stringify(answers)}\``);
  if (plan.notes.length > 0) {
    console.log(`Notes: ${plan.notes.join(', ')}`);
  }
  console.log('');
  console.log(formatPlanMarkdown(plan, { language }));
  console.log('');
}
