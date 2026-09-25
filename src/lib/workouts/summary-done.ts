/**
 * What the summary does after "Fertig". The session itself is saved by
 * finishSession; plan changes (adopt, progressions) follow. Two rules keep a
 * saved unit from ending on "Speichern fehlgeschlagen":
 * - once the unit is saved the store has no active session any more, so a
 *   second "Fertig" (the summary still on screen) must not finish again;
 * - without the unit's template (a new plan replaced it while the unit ran)
 *   there is nothing to change in the plan, and the summary still closes.
 */

export type FinishOutcome = 'saved' | 'alreadySaved' | 'failed';

export function finishOutcome(result: { ok: boolean; error?: unknown }): FinishOutcome {
  if (result.ok) {
    return 'saved';
  }
  // The store only drops the active session after a successful finish (or a
  // discard, which never shows this summary).
  return result.error instanceof Error && result.error.message === 'no_active_session'
    ? 'alreadySaved'
    : 'failed';
}

export type AfterProgress<C> = { kind: 'celebrate'; celebration: C } | { kind: 'dismiss' };

/** Celebrate accepted steps written to the template, otherwise close the summary. */
export function afterProgress<C>(params: {
  templateFound: boolean;
  celebration: C | null;
}): AfterProgress<C> {
  if (params.templateFound && params.celebration != null) {
    return { kind: 'celebrate', celebration: params.celebration };
  }
  return { kind: 'dismiss' };
}
