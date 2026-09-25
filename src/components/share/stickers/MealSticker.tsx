import { useTranslation } from 'react-i18next';

import {
  STICKER_PALETTES,
  StickerFrame,
  StickerStack,
  StickerText,
  stickerStyles as s,
} from '@/components/share/stickers/sticker-parts';
import type {
  MealStickerData,
  StickerFormat,
  StickerOptions,
  StickerVariant,
} from '@/lib/share/sticker-data';

type MealStickerProps = {
  data: MealStickerData;
  variant: StickerVariant;
  options: StickerOptions;
  format?: StickerFormat;
};

/**
 * Meal right after the photo scan: the recognised ingredients, kcal and
 * protein. As a story card the photo sits behind it; as a sticker there is
 * no photo, only the labels.
 */
export function MealSticker({ data, variant, options, format = 'sticker' }: MealStickerProps) {
  const { t } = useTranslation();
  const palette = STICKER_PALETTES[variant];
  const showProtein = options.showProtein && data.proteinG != null;
  return (
    <StickerFrame
      variant={variant}
      format={format}
      storyPhotoUri={format === 'story' ? data.photoUri : null}>
      <StickerStack style={s.stack}>
        <StickerText
          style={[s.title, { color: palette.text }, palette.shadow]}
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.6}>
          {t('share.meal.title')}
        </StickerText>
        <StickerStack style={mealStyles.labels}>
          {data.labels.map((label) => (
            <StickerStack
              key={label}
              style={[mealStyles.label, { borderColor: palette.faint }]}>
              <StickerText
                style={[mealStyles.labelText, { color: palette.text }, palette.shadow]}
                numberOfLines={1}>
                {label}
              </StickerText>
            </StickerStack>
          ))}
        </StickerStack>
        <StickerStack style={mealStyles.figures}>
          <StickerText
            style={[s.hero, { color: palette.text }, palette.shadow]}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.6}>
            {t('share.meal.kcal', { value: data.kcal })}
          </StickerText>
          {showProtein ? (
            <StickerText style={[s.sub, { color: palette.muted }, palette.shadow]}>
              {t('share.meal.protein', { value: data.proteinG })}
            </StickerText>
          ) : null}
        </StickerStack>
      </StickerStack>
    </StickerFrame>
  );
}

const mealStyles = {
  labels: {
    flexDirection: 'row' as const,
    flexWrap: 'wrap' as const,
    gap: 8,
  },
  label: {
    borderWidth: 1.5,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  labelText: {
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '600' as const,
  },
  figures: {
    gap: 2,
  },
};
