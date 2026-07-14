import { localDateKey } from '@/lib/day-window';
import { supabase } from '@/lib/supabase';

export async function upsertDailyCalorieGoal(params: {
  userId: string;
  dailyCalorieGoal: number;
  effectiveFrom?: string;
}) {
  const effectiveFromDate = params.effectiveFrom ?? localDateKey();

  // Upsert on (user_id, effective_from) — safe for multiple HealthKit toggles same day.
  const { error } = await supabase.from('calorie_goals').upsert(
    {
      user_id: params.userId,
      daily_calorie_goal: params.dailyCalorieGoal,
      effective_from: effectiveFromDate,
    },
    { onConflict: 'user_id,effective_from' },
  );

  if (error) {
    throw error;
  }
}

export function logCalorieGoalSaveError(context: string, error: unknown) {
  console.error(`[${context}] save failed:`, error);

  if (error && typeof error === 'object') {
    const supabaseError = error as {
      code?: string;
      message?: string;
      details?: string;
      hint?: string;
    };

    console.error(`[${context}] save failed details:`, {
      code: supabaseError.code,
      message: supabaseError.message,
      details: supabaseError.details,
      hint: supabaseError.hint,
    });
  }
}

export function getCalorieGoalErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  if (error && typeof error === 'object' && 'message' in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === 'string' && message.length > 0) {
      return message;
    }
  }

  return fallback;
}
