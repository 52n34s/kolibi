/**
 * What the summary screen shows after the progression decisions are in.
 *
 * One accepted level-up is the big moment. Several at once used to show only
 * the first one, so the rest of the work went unseen: they now share one
 * screen with a count and a line per level. Praise (more sets, a wider range,
 * more time, more load) is the small version — on its own it carries the
 * screen, next to levels it is one line underneath.
 */

export type ProgressionToTarget = {
  targetSets?: number | null;
  targetReps?: number | null;
  targetRepsMax?: number | null;
  targetSeconds?: number | null;
  targetSecondsMax?: number | null;
};

export type AcceptedLevelUp = {
  kind: 'variant_up';
  name: string;
  step: number;
  total: number;
  /** Opaque sticker payload for sharing; the screen knows its shape. */
  levelSticker: unknown | null;
};

export type AcceptedPraise = {
  kind: 'praise';
  name: string;
  praiseKey: string;
  toTarget?: ProgressionToTarget;
};

export type AcceptedProgression = AcceptedLevelUp | AcceptedPraise;

export type CelebrationLevel = Omit<AcceptedLevelUp, 'kind'>;

export type Celebration =
  | ({ mode: 'single_level' } & CelebrationLevel)
  | {
      mode: 'multi_level';
      count: number;
      levels: CelebrationLevel[];
      /** Shown as one short line under the levels; null when nothing else was accepted. */
      praiseLine: AcceptedPraise | null;
    }
  | ({ mode: 'praise_only' } & Omit<AcceptedPraise, 'kind'>);

/** Title of the multi-level screen, with {{count}}. */
export const CELEBRATION_MULTI_TITLE_KEY = 'training.progression.celebration.multiTitle';

/** One line per level; the same key the single-level screen uses. */
export const CELEBRATION_LEVEL_KEY = 'training.progression.celebration.level';

export function buildCelebration(accepted: readonly AcceptedProgression[]): Celebration | null {
  const levels: CelebrationLevel[] = [];
  const praises: AcceptedPraise[] = [];
  for (const item of accepted) {
    if (item.kind === 'variant_up') {
      const { kind: _kind, ...level } = item;
      levels.push(level);
    } else {
      praises.push(item);
    }
  }

  if (levels.length === 1) {
    return { mode: 'single_level', ...levels[0]! };
  }
  if (levels.length > 1) {
    return { mode: 'multi_level', count: levels.length, levels, praiseLine: praises[0] ?? null };
  }
  const praise = praises[0];
  if (praise) {
    const { kind: _kind, ...rest } = praise;
    return { mode: 'praise_only', ...rest };
  }
  return null;
}
