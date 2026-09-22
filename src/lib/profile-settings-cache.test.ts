import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { QueryClient } from '@tanstack/react-query';

import {
  profileSettingsQueryKey,
  setProfileSettingsTargetWeight,
} from './profile-settings-cache.ts';

describe('setProfileSettingsTargetWeight', () => {
  it('writes into the exact key GoalsPanel / useProfileSettings reads', () => {
    const userId = 'user-1';
    const key = profileSettingsQueryKey(userId);
    const queryClient = new QueryClient();

    queryClient.setQueryData(key, {
      profile: {
        target_weight_kg: 77,
        progress_start_date: '2026-01-01',
        display_name: 'Steffen',
      },
      subscription: null,
      avatarSignedUrl: null,
      premiumAccess: { isPremium: false },
    });

    const patched = setProfileSettingsTargetWeight(queryClient, userId, {
      targetWeightKg: 82,
      progressStartDate: '2026-09-22',
    });

    assert.equal(patched, true);

    const next = queryClient.getQueryData<{
      profile: {
        target_weight_kg: number;
        progress_start_date: string;
        display_name: string;
      };
    }>(key);

    assert.equal(next?.profile.target_weight_kg, 82);
    assert.equal(next?.profile.progress_start_date, '2026-09-22');
    assert.equal(next?.profile.display_name, 'Steffen');

    // Same key the list invalidates / reads — not home-dashboard / history / macro-goal-editor
    assert.deepEqual(key, ['profile-settings', userId]);

    const matches = queryClient
      .getQueryCache()
      .findAll({ queryKey: ['profile-settings', userId] });
    assert.equal(matches.length, 1);
    assert.equal(
      (matches[0]?.state.data as { profile: { target_weight_kg: number } }).profile
        .target_weight_kg,
      82,
    );
  });

  it('returns false when the list query has no cached profile yet', () => {
    const queryClient = new QueryClient();
    assert.equal(
      setProfileSettingsTargetWeight(queryClient, 'user-1', {
        targetWeightKg: 82,
        progressStartDate: null,
      }),
      false,
    );
  });
});
