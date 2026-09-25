import * as Sentry from '@sentry/react-native';

import { createSchemaProbe, isMissingSchemaError } from '@/lib/db-schema-errors';
import { supabase } from '@/lib/supabase';

/** Active skill goal ("10 Archer-Klimmzüge"). One per user. */
export type SkillGoal = {
  id: string;
  exerciseId: string;
  targetValue: number;
  createdAt: string;
  achievedAt: string | null;
};

type SkillGoalRow = {
  id: string;
  exercise_id: string;
  target_value: number | string;
  created_at: string;
  achieved_at: string | null;
};

const SKILL_GOAL_SELECT = 'id, exercise_id, target_value, created_at, achieved_at';

/** False until migration 20260926160000_skill_goals has run: the feature stays hidden. */
export const hasSkillGoals = createSchemaProbe(() =>
  supabase.from('skill_goals').select('id').limit(0),
);

function mapRow(row: SkillGoalRow): SkillGoal {
  return {
    id: row.id,
    exerciseId: row.exercise_id,
    targetValue: Number(row.target_value),
    createdAt: row.created_at,
    achievedAt: row.achieved_at,
  };
}

async function requireUserId(): Promise<string> {
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user?.id) {
    throw error ?? new Error('not_authenticated');
  }
  return data.user.id;
}

/** `available` is false while the table does not exist yet (feature hidden). */
export type SkillGoalState = { available: boolean; goal: SkillGoal | null };

export async function fetchActiveSkillGoal(): Promise<SkillGoalState> {
  if (!(await hasSkillGoals())) {
    return { available: false, goal: null };
  }
  const userId = await requireUserId();
  const { data, error } = await supabase
    .from('skill_goals')
    .select(SKILL_GOAL_SELECT)
    .eq('user_id', userId)
    .is('archived_at', null)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) {
    if (isMissingSchemaError(error)) {
      return { available: false, goal: null };
    }
    Sentry.captureException(error);
    throw error;
  }
  return { available: true, goal: data ? mapRow(data as SkillGoalRow) : null };
}

/** Archives the current goal and starts a new one. */
export async function saveSkillGoal(input: {
  exerciseId: string;
  targetValue: number;
}): Promise<SkillGoal> {
  const userId = await requireUserId();
  await archiveActiveSkillGoal();
  const { data, error } = await supabase
    .from('skill_goals')
    .insert({
      user_id: userId,
      exercise_id: input.exerciseId,
      target_value: Math.round(input.targetValue),
    })
    .select(SKILL_GOAL_SELECT)
    .single();
  if (error) {
    Sentry.captureException(error);
    throw error;
  }
  return mapRow(data as SkillGoalRow);
}

export async function archiveActiveSkillGoal(): Promise<void> {
  const userId = await requireUserId();
  const { error } = await supabase
    .from('skill_goals')
    .update({ archived_at: new Date().toISOString() })
    .eq('user_id', userId)
    .is('archived_at', null);
  if (error) {
    Sentry.captureException(error);
    throw error;
  }
}

export async function markSkillGoalAchieved(goalId: string): Promise<void> {
  const { error } = await supabase
    .from('skill_goals')
    .update({ achieved_at: new Date().toISOString() })
    .eq('id', goalId)
    .is('achieved_at', null);
  if (error) {
    Sentry.captureException(error);
    throw error;
  }
}
