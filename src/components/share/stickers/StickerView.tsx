import { ExerciseSticker } from '@/components/share/stickers/ExerciseSticker';
import { GoalSticker } from '@/components/share/stickers/GoalSticker';
import { LevelSticker } from '@/components/share/stickers/LevelSticker';
import { MealSticker } from '@/components/share/stickers/MealSticker';
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
  /** Every sticker type also comes as a 1080 × 1920 story card. */
  format?: StickerFormat;
};

export function StickerView({ data, variant, options, format }: StickerViewProps) {
  switch (data.kind) {
    case 'exercise':
      return <ExerciseSticker data={data} variant={variant} options={options} format={format} />;
    case 'level':
      return <LevelSticker data={data} variant={variant} options={options} format={format} />;
    case 'session':
      return <SessionSticker data={data} variant={variant} options={options} format={format} />;
    case 'recap':
      return <RecapSticker data={data} variant={variant} options={options} format={format} />;
    case 'progress':
      return <ProgressSticker data={data} variant={variant} options={options} format={format} />;
    case 'meal':
      return <MealSticker data={data} variant={variant} options={options} format={format} />;
    case 'goal':
      return <GoalSticker data={data} variant={variant} options={options} format={format} />;
  }
}
