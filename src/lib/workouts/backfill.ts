import {
  buildActiveSessionFromTemplate,
  defaultSetValue,
  markSessionFinished,
} from './session-logic';
import type { ActiveSession, GymIntensity, WorkoutTemplate } from './types';

/**
 * Build a finished-ready ActiveSession for "Einheit nachtragen":
 * all sets marked done, values = lower target bound, timestamps from date + duration.
 */
export function buildBackfillSession(
  template: WorkoutTemplate,
  opts: {
    userId: string;
    loggedOn: string;
    durationMinutes: number;
    intensity: GymIntensity;
    lang?: string;
    /** Local noon ISO for the logged-on day; defaults to `${loggedOn}T12:00:00.000`. */
    startedAt?: string;
  },
): ActiveSession {
  const durationMinutes = Math.max(1, Math.round(opts.durationMinutes));
  const startedAt = opts.startedAt ?? `${opts.loggedOn}T12:00:00.000`;
  const startedMs = Date.parse(startedAt);
  const finishedAt = new Date(
    (Number.isFinite(startedMs) ? startedMs : Date.now()) + durationMinutes * 60_000,
  ).toISOString();

  const base = buildActiveSessionFromTemplate(template, {
    userId: opts.userId,
    loggedOn: opts.loggedOn,
    startedAt: Number.isFinite(startedMs)
      ? new Date(startedMs).toISOString()
      : new Date().toISOString(),
    lang: opts.lang,
  });

  const items = base.items.map((item) => {
    const value = defaultSetValue(item);
    return {
      ...item,
      sets: item.sets.map((set) => ({
        ...set,
        value,
        done: true,
        completedAt: finishedAt,
        secondsOtherSide:
          item.kind === 'time' && item.perSide ? value : null,
      })),
    };
  });

  return markSessionFinished(
    {
      ...base,
      items,
      finishedAt,
      cursor: { exerciseIndex: 0, setIndex: 0 },
    },
    opts.intensity,
    finishedAt,
  );
}
