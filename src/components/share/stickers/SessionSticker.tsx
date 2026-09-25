import { useTranslation } from 'react-i18next';

import {
  STICKER_PALETTES,
  StickerFrame,
  StickerStack,
  StickerStat,
  StickerStatGrid,
  StickerText,
  formatStickerDate,
  stickerStyles as s,
} from '@/components/share/stickers/sticker-parts';
import {
  formatStickerValue,
  type SessionStickerData,
  type StickerFormat,
  type StickerOptions,
  type StickerVariant,
} from '@/lib/share/sticker-data';

type SessionStickerProps = {
  data: SessionStickerData;
  variant: StickerVariant;
  options: StickerOptions;
  format?: StickerFormat;
};

export function SessionSticker({ data, variant, options, format = 'sticker' }: SessionStickerProps) {
  const { t, i18n } = useTranslation();
  const palette = STICKER_PALETTES[variant];
  return (
    <StickerFrame variant={variant} format={format}>
      <StickerStack style={s.stack}>
        <StickerStack>
          <StickerText
            style={[s.title, { color: palette.text }, palette.shadow]}
            numberOfLines={format === 'story' ? 1 : 2}
            adjustsFontSizeToFit={format === 'story'}
            minimumFontScale={0.6}>
            {data.name}
          </StickerText>
          {options.showDate ? (
            <StickerText style={[s.sub, { color: palette.muted }, palette.shadow]}>
              {formatStickerDate(data.dateKey, i18n.language)}
            </StickerText>
          ) : null}
        </StickerStack>
        <StickerStatGrid>
          <StickerStat
            label={t('share.stats.duration')}
            value={t('share.minutes', { n: data.durationMinutes })}
            palette={palette}
          />
          {/* A time-only session has no reps; its hold time says more than a 0. */}
          {data.totalReps > 0 || data.totalSeconds === 0 ? (
            <StickerStat
              label={t('share.stats.reps')}
              value={String(data.totalReps)}
              palette={palette}
            />
          ) : (
            <StickerStat
              label={t('share.stats.seconds')}
              value={String(data.totalSeconds)}
              palette={palette}
            />
          )}
          {data.bestsCount > 0 ? (
            <StickerStat
              label={t('share.stats.bests')}
              value={String(data.bestsCount)}
              palette={palette}
            />
          ) : null}
          {data.levelsCount > 0 ? (
            <StickerStat
              label={t('share.stats.levels')}
              value={String(data.levelsCount)}
              palette={palette}
            />
          ) : null}
        </StickerStatGrid>
        {options.showTopExercises && data.topExercises.length > 0 ? (
          <StickerStack style={s.list}>
            {data.topExercises.map((row) => (
              <StickerStack key={row.name} style={s.listRow}>
                <StickerText
                  style={[s.listName, { color: palette.text }, palette.shadow]}
                  numberOfLines={1}>
                  {row.name}
                </StickerText>
                <StickerText style={[s.listValue, { color: palette.text }, palette.shadow]}>
                  {formatStickerValue(row.best, row.exerciseKind)}
                </StickerText>
              </StickerStack>
            ))}
          </StickerStack>
        ) : null}
      </StickerStack>
    </StickerFrame>
  );
}
