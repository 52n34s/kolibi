import { useTranslation } from 'react-i18next';
import { StyleSheet } from 'react-native';
import Svg, { Circle, Polyline } from 'react-native-svg';

import {
  ANTHRACITE,
  STICKER_PALETTES,
  StickerFrame,
  StickerLadder,
  StickerStack,
  StickerText,
  stickerStyles as s,
  useStickerScale,
  type StickerPalette,
} from '@/components/share/stickers/sticker-parts';
import { BRAND_MINT } from '@/constants/brand';
import {
  formatStickerValue,
  PROGRESS_PERIOD_WEEKS,
  progressCurveLevels,
  type ProgressPoint,
  type ProgressStickerData,
  type ProgressView,
  type StickerFormat,
  type StickerOptions,
  type StickerVariant,
} from '@/lib/share/sticker-data';
import { STICKER_LAYOUT_WIDTH } from '@/lib/share/sticker-export';

type ProgressStickerProps = {
  data: ProgressStickerData;
  variant: StickerVariant;
  options: StickerOptions;
  format?: StickerFormat;
};

/** Sticker side padding (sticker-parts) on both sides. */
const CONTENT_WIDTH = STICKER_LAYOUT_WIDTH - 48;
const CURVE_HEIGHT = 64;
const CURVE_PAD = 8;

export function ProgressSticker({ data, variant, options, format = 'sticker' }: ProgressStickerProps) {
  const { t } = useTranslation();
  const palette = STICKER_PALETTES[variant];
  const view = data.views[data.period];
  if (!view) {
    return null;
  }
  const since =
    data.period === 'all'
      ? t('share.progress.sinceStart')
      : t('share.progress.weeksAgo', { count: PROGRESS_PERIOD_WEEKS[data.period] });
  const valueOf = (point: ProgressPoint) =>
    view.levelChanged && point.step != null && data.ladderTotal != null
      ? t('share.level', { n: point.step, total: data.ladderTotal })
      : formatStickerValue(point.value, data.exerciseKind);

  return (
    <StickerFrame variant={variant} format={format}>
      <StickerStack style={s.stack}>
        <StickerStack>
          <StickerText style={[s.small, styles.eyebrow, { color: palette.muted }, palette.shadow]}>
            {t('share.progress.title')}
          </StickerText>
          <StickerText
            style={[s.title, { color: palette.text }, palette.shadow]}
            numberOfLines={1}
            adjustsFontSizeToFit>
            {data.name}
          </StickerText>
        </StickerStack>

        {view.levelChanged ? (
          // Levels are long ("Stufe 3 von 5"): one line each instead of side by side.
          <StickerStack style={styles.levelCompare}>
            <StickerStack style={styles.levelRow}>
              <StickerText
                style={[s.small, { color: palette.muted }, palette.shadow]}
                numberOfLines={1}>
                {since}
              </StickerText>
              <StickerText
                style={[styles.startValue, { color: palette.muted }, palette.shadow]}
                numberOfLines={1}
                adjustsFontSizeToFit>
                {valueOf(view.start)}
              </StickerText>
            </StickerStack>
            <StickerStack style={styles.levelRow}>
              <StickerText
                style={[s.small, { color: palette.muted }, palette.shadow]}
                numberOfLines={1}>
                {t('share.progress.today')}
              </StickerText>
              <StickerStack style={styles.currentPill}>
                <StickerText style={styles.currentValue} numberOfLines={1} adjustsFontSizeToFit>
                  {valueOf(view.current)}
                </StickerText>
              </StickerStack>
            </StickerStack>
          </StickerStack>
        ) : (
          <StickerStack style={styles.compare}>
            <StickerStack style={styles.side}>
              <StickerText
                style={[s.small, { color: palette.muted }, palette.shadow]}
                numberOfLines={1}
                adjustsFontSizeToFit>
                {since}
              </StickerText>
              <StickerText
                style={[styles.startValue, { color: palette.muted }, palette.shadow]}
                numberOfLines={1}
                adjustsFontSizeToFit>
                {valueOf(view.start)}
              </StickerText>
            </StickerStack>
            <StickerText style={[styles.arrow, { color: palette.muted }, palette.shadow]}>→</StickerText>
            <StickerStack style={styles.side}>
              <StickerText
                style={[s.small, { color: palette.muted }, palette.shadow]}
                numberOfLines={1}
                adjustsFontSizeToFit>
                {t('share.progress.today')}
              </StickerText>
              <StickerStack style={styles.currentPill}>
                <StickerText style={styles.currentValue} numberOfLines={1} adjustsFontSizeToFit>
                  {valueOf(view.current)}
                </StickerText>
              </StickerStack>
            </StickerStack>
          </StickerStack>
        )}
        {data.perSide ? (
          <StickerText style={[s.small, { color: palette.muted }, palette.shadow]}>
            {t('share.perSide')}
          </StickerText>
        ) : null}

        <ProgressCurve view={view} palette={palette} />

        {options.showLevel && view.levelChanged && view.current.step != null && data.ladderTotal != null ? (
          <StickerStack style={styles.levelBlock}>
            <StickerLadder level={{ step: view.current.step, total: data.ladderTotal }} palette={palette} />
            <StickerText
              style={[s.small, { color: palette.muted }, palette.shadow]}
              numberOfLines={1}
              adjustsFontSizeToFit>
              {view.start.exerciseName} → {view.current.exerciseName}
            </StickerText>
          </StickerStack>
        ) : null}
      </StickerStack>
    </StickerFrame>
  );
}

/**
 * Best set per session, no axes. On a ladder each rung gets its own segment:
 * reps of two different exercises are not joined into one line.
 */
function ProgressCurve({ view, palette }: { view: ProgressView; palette: StickerPalette }) {
  const scale = useStickerScale();
  // Full content width on both formats; only height and strokes scale.
  const width = CONTENT_WIDTH;
  const height = CURVE_HEIGHT * scale;
  const pad = CURVE_PAD * scale;
  const levels = progressCurveLevels(view.points);
  const flat = levels.every((level) => level === levels[0]);
  const coords = view.points.map((point, index) => ({
    x: pad + (index * (width - 2 * pad)) / Math.max(1, view.points.length - 1),
    y: flat ? height / 2 : pad + (1 - levels[index]) * (height - 2 * pad),
    step: point.step,
  }));
  const segments: (typeof coords)[] = [];
  for (const coord of coords) {
    const last = segments[segments.length - 1];
    if (last && last[last.length - 1].step === coord.step) {
      last.push(coord);
    } else {
      segments.push([coord]);
    }
  }
  const end = coords[coords.length - 1];
  return (
    <Svg width={width} height={height}>
      {segments.map((segment, index) =>
        segment.length > 1 ? (
          <Polyline
            key={index}
            points={segment.map((c) => `${c.x},${c.y}`).join(' ')}
            fill="none"
            stroke={palette.text}
            strokeWidth={3 * scale}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ) : (
          <Circle key={index} cx={segment[0].x} cy={segment[0].y} r={2.5 * scale} fill={palette.text} />
        ),
      )}
      <Circle
        cx={end.x}
        cy={end.y}
        r={6 * scale}
        fill={BRAND_MINT}
        stroke={palette.text}
        strokeWidth={2.5 * scale}
      />
    </Svg>
  );
}

const styles = StyleSheet.create({
  eyebrow: {
    fontWeight: '700',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  compare: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 12,
  },
  side: {
    flex: 1,
    gap: 4,
  },
  arrow: {
    fontSize: 24,
    lineHeight: 34,
    fontWeight: '700',
  },
  startValue: {
    fontSize: 24,
    lineHeight: 32,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  currentPill: {
    alignSelf: 'flex-start',
    maxWidth: '100%',
    backgroundColor: BRAND_MINT,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 2,
  },
  currentValue: {
    color: ANTHRACITE,
    fontSize: 28,
    lineHeight: 36,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  levelBlock: {
    gap: 6,
  },
  levelCompare: {
    gap: 8,
  },
  levelRow: {
    gap: 2,
  },
});
