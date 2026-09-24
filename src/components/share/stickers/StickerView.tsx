import { ExerciseSticker } from '@/components/share/stickers/ExerciseSticker';
import { LevelSticker } from '@/components/share/stickers/LevelSticker';
import { ProgressSticker } from '@/components/share/stickers/ProgressSticker';
import { RecapSticker } from '@/components/share/stickers/RecapSticker';
import { SessionSticker } from '@/components/share/stickers/SessionSticker';
import type {
  StickerData,
  StickerFormat,
  StickerOptions,
  StickerVariant,
} from '@/lib/share/sticker-data';

type StickerViewProps = {
  data: StickerData;
  variant: StickerVariant;
  options: StickerOptions;
  /** Recaps and progress stickers also come as a story card. */
  format?: StickerFormat;
};

export function StickerView({ data, variant, options, format }: StickerViewProps) {
  switch (data.kind) {
    case 'exercise':
      return <ExerciseSticker data={data} variant={variant} options={options} />;
    case 'level':
      return <LevelSticker data={data} variant={variant} options={options} />;
    case 'session':
      return <SessionSticker data={data} variant={variant} options={options} />;
    case 'recap':
      return <RecapSticker data={data} variant={variant} options={options} format={format} />;
    case 'progress':
      return <ProgressSticker data={data} variant={variant} options={options} format={format} />;
  }
}
