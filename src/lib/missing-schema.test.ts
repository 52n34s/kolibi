import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { isMissingSchemaError } from './missing-schema.ts';

describe('isMissingSchemaError', () => {
  it('detects PostgREST and Postgres codes', () => {
    for (const code of ['PGRST204', 'PGRST205', '42703', '42P01']) {
      assert.equal(isMissingSchemaError({ code, message: '' }), true, code);
    }
  });

  it('detects the messages when the code is missing', () => {
    assert.equal(
      isMissingSchemaError({
        message: "Could not find the 'plan_wizard_answers' column of 'profiles' in the schema cache",
      }),
      true,
    );
    assert.equal(
      isMissingSchemaError({ message: 'column profiles.plan_wizard_answers does not exist' }),
      true,
    );
  });

  it('leaves other errors alone', () => {
    assert.equal(isMissingSchemaError(null), false);
    assert.equal(isMissingSchemaError('boom'), false);
    assert.equal(isMissingSchemaError({ code: '23505', message: 'duplicate key' }), false);
    assert.equal(isMissingSchemaError(new Error('Network request failed')), false);
  });
});
