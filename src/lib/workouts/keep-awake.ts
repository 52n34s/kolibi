import type { ActiveSession } from './types';

/**
 * The screen stays on while a workout is being logged, on every tab and
 * screen. The summary no longer counts: the workout is over.
 */
export function shouldKeepScreenAwake(active: Pick<ActiveSession, 'phase'> | null): boolean {
  return active?.phase === 'active';
}
