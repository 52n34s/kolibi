import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import {
  STICKER_PALETTES,
  StickerBadge,
  StickerFrame,
  StickerLevelLine,
  StickerText,
  stickerStyles as s,
} from '@/components/share/stickers/sticker-parts';
import type { LevelStickerData, StickerOptions, StickerVariant } from '@/lib/share/sticker-data';

type LevelStickerProps = {
  data: LevelStickerData;
  variant: StickerVariant;
  options: StickerOptions;
};

export function LevelSticker({ data, variant, options }: LevelStickerProps) {
  const { t } = useTranslation();
  const palette = STICKER_PALETTES[variant];
  return (
    <StickerFrame variant={variant}>
      <View style={s.stack}>
        <StickerBadge label={t('share.newLevel')} />
        <StickerText style={[s.title, { color: palette.text }, palette.shadow]} numberOfLines={2}>
          {data.name}
        </StickerText>
        <StickerLevelLine level={data.level} palette={palette} />
        {options.showPrevious && data.previousName ? (
          <StickerText
            style={[s.small, { color: palette.muted }, palette.shadow]}
            numberOfLines={1}>
            {t('share.previousLevel', { name: data.previousName })}
          </StickerText>
        ) : null}
      </View>
    </StickerFrame>
  );
}
