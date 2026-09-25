export const BRAND_INDIGO = '#4F46E5';
export const BRAND_INDIGO_DEEP = '#3A31B8';
export const BRAND_MINT = '#7CE7C7';
export const SURFACE_BASE = '#FFFFFF';
export const BEAM_INDIGO = '#4F46E5';

/** Secondary copy on indigo glass — warmer than neutral gray, AA contrast. */
export const TEXT_SECONDARY = '#6B6BA8';
/** Placeholders and very quiet hints. */
export const TEXT_TERTIARY = '#9494C4';

export const GLASS_BORDER = 'rgba(79, 70, 229, 0.13)';
export const GLASS_BORDER_TOP = 'rgba(255, 255, 255, 0.95)';

/**
 * Outline for standalone chips that carry a toggle on their own (no card
 * behind them). GLASS_BORDER lands at ~1.2:1 on the home mesh and vanishes —
 * these need to read as a control, so this clears 3:1 across the mesh range
 * (rgb(220,218,250) is the worst case at 3.09:1).
 */
export const CHIP_BORDER = 'rgba(79, 70, 229, 0.75)';
/** Filled chip state. Deeper than GLASS_SURFACE, which is invisible at 1.1:1. */
export const CHIP_SURFACE_SELECTED = 'rgba(79, 70, 229, 0.22)';

/** Workout unit accent colors (templates / week dots). */
export const TRAINING_UNIT_COLORS = {
  indigo: '#4F46E5',
  violet: '#8B5CF6',
  sky: '#0EA5E9',
  teal: '#14B8A6',
  amber: '#F59E0B',
  pink: '#EC4899',
} as const;

/**
 * The one accent of the Today recommendations (Block 3.3). Used sparingly and
 * always next to an icon: the icon itself and its soft badge behind it
 * (this colour at low opacity). Teal-700 clears 5:1 on white.
 */
export const RECOMMENDATION_ACCENT = '#0F766E';
