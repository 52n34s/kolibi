import { supabase } from '@/lib/supabase';

const TOUCH_THROTTLE_MS = 5 * 60 * 1000;

/** In-memory only — resets on cold start (intentional). */
let lastTouchAtMs = 0;

/**
 * Best-effort heartbeat: updates profiles.last_active_at via RPC.
 * Failures are logged and swallowed so activity tracking never blocks UX.
 */
export async function touchUserActivity(userId: string): Promise<void> {
  const { error } = await supabase.rpc('touch_user_activity', {
    p_user_id: userId,
  });

  if (error) {
    console.warn('[Activity] touch_user_activity failed:', error.message);
    return;
  }

  lastTouchAtMs = Date.now();
}

/**
 * Same as touchUserActivity, but skips if called within the last 5 minutes.
 * Used for AppState foreground heartbeats.
 */
export async function touchUserActivityThrottled(userId: string): Promise<void> {
  if (Date.now() - lastTouchAtMs < TOUCH_THROTTLE_MS) {
    return;
  }

  // Reserve the throttle window before the await to avoid concurrent duplicate RPCs.
  lastTouchAtMs = Date.now();

  const { error } = await supabase.rpc('touch_user_activity', {
    p_user_id: userId,
  });

  if (error) {
    console.warn('[Activity] touch_user_activity failed:', error.message);
  }
}
