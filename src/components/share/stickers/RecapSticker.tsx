import { useTranslation } from 'react-i18next';

import {
  STICKER_PALETTES,
  StickerFitLine,
  StickerFrame,
  StickerStack,
  StickerStat,
  StickerStatGrid,
  StickerText,
  stickerStyles as s,
} from '@/components/share/stickers/sticker-parts';
import {
  formatGain,
  type RecapStickerData,
  type StickerFormat,
  type StickerOptions,
  type StickerVariant,
} from '@/lib/share/sticker-data';

type RecapStickerProps = {
  data: RecapStickerData;
  variant: StickerVariant;
  options: StickerOptions;
  /** Transparent sticker or 1080 × 1920 story card on the brand background. */
  format?: StickerFormat;
};

export function RecapSticker({ data, variant, options, format = 'sticker' }: RecapStickerProps) {
  const { t } = useTranslation();
  const palette = STICKER_PALETTES[variant];
  return (
    <StickerFrame variant={variant} format={format}>
      <StickerStack style={s.stack}>
        <StickerFitLine
          text={data.period === 'month' ? t('share.myMonth') : t('share.myWeek')}
          style={[s.recapTitle, { color: palette.text }, palette.shadow]}
          baseFontSize={s.recapTitle.fontSize}
          baseLineHeight={s.recapTitle.lineHeight}
        />
        <StickerStatGrid>
          <StickerStat
            label={t('share.stats.sessions')}
            value={String(data.sessions)}
            palette={palette}
          />
          <StickerStat label={t('share.stats.reps')} value={String(data.totalReps)} palette={palette} />
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
        {options.showBiggestGain && data.biggestGain ? (
          <StickerStack>
            <StickerText style={[s.small, { color: palette.muted }, palette.shadow]}>
              {t('share.biggestGain')}
            </StickerText>
            <StickerText
              style={[s.sub, { color: palette.text }, palette.shadow]}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.6}>
              {formatGain(data.biggestGain)}
            </StickerText>
          </StickerStack>
        ) : null}
        {options.showProtein && data.proteinHitDays > 0 ? (
          <StickerText style={[s.sub, { color: palette.muted }, palette.shadow]}>
            {t('share.protein', { count: data.proteinHitDays })}
          </StickerText>
        ) : null}
      </StickerStack>
    </StickerFrame>
  );
}
