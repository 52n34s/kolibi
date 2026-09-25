import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  KOLIBI_TEMPLATE_PRESETS,
  buildKolibiTemplate,
  getKolibiTemplatePreset,
} from './kolibi-template-presets.ts';

describe('KOLIBI_TEMPLATE_PRESETS', () => {
  it('has unique ids and planWizard i18n keys', () => {
    const ids = KOLIBI_TEMPLATE_PRESETS.map((preset) => preset.id);
    assert.equal(new Set(ids).size, ids.length);
    for (const preset of KOLIBI_TEMPLATE_PRESETS) {
      assert.equal(preset.titleKey, `planWizard.presets.${preset.id}.title`);
      assert.equal(preset.subtitleKey, `planWizard.presets.${preset.id}.subtitle`);
    }
  });

  it('builds the expected sessions', () => {
    const kinds = (id: Parameters<typeof buildKolibiTemplate>[0]) =>
      buildKolibiTemplate(id).sessions.map((session) => session.kind);
    assert.deepEqual(kinds('full_body_beginner'), ['full_a', 'full_b']);
    assert.deepEqual(kinds('push_pull_legs_advanced'), ['push', 'pull_legs']);
    assert.deepEqual(kinds('chest_shoulders_focus'), ['chest_shoulders']);
    assert.deepEqual(kinds('short_20'), ['full']);

    const short = buildKolibiTemplate('short_20').sessions[0]!;
    assert.equal(short.exercises.length, 3);
    assert.ok(short.estimatedMinutes <= 20);
  });

  it('throws for unknown ids', () => {
    assert.throws(() => getKolibiTemplatePreset('nope' as never), /unknown_kolibi_template_preset/);
  });
});
