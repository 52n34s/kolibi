import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { createContext, useContext, useRef, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import {
  StyleSheet,
  Text,
  View,
  type LayoutChangeEvent,
  type StyleProp,
  type TextProps,
  type TextStyle,
  type ViewStyle,
} from 'react-native';

import { StickerBrand } from '@/components/share/StickerBrand';
import { BRAND_INDIGO, BRAND_INDIGO_DEEP, BRAND_MINT } from '@/constants/brand';
import {
  nextStoryScale,
  type LadderPosition,
  type StickerFormat,
  type StickerVariant,
} from '@/lib/share/sticker-data';
import { STICKER_LAYOUT_WIDTH, STORY_LAYOUT_HEIGHT } from '@/lib/share/sticker-export';

export const ANTHRACITE = '#1F2328';

export type StickerPalette = {
  text: string;
  muted: string;
  faint: string;
  shadow: TextStyle | null;
};

/** Light: white type for dark video. Dark: anthracite for bright backgrounds. */
export const STICKER_PALETTES: Record<StickerVariant, StickerPalette> = {
  light: {
    text: '#FFFFFF',
    muted: 'rgba(255,255,255,0.82)',
    faint: 'rgba(255,255,255,0.4)',
    shadow: {
      textShadowColor: 'rgba(0,0,0,0.35)',
      textShadowOffset: { width: 0, height: 1 },
      textShadowRadius: 6,
    },
  },
  dark: {
    text: ANTHRACITE,
    muted: 'rgba(31,35,40,0.66)',
    faint: 'rgba(31,35,40,0.22)',
    shadow: null,
  },
};

/** First guess for the story card; `StoryFrame` then fits the content to the card. */
export const STORY_CONTENT_SCALE = 1.5;
/** Content scale on a story photo: readable, and most of the photo stays visible. */
export const STORY_PHOTO_CONTENT_SCALE = 1.3;
/** Re-measure passes before the fit stops (wrapping can make it oscillate). */
const STORY_FIT_PASSES = 6;
/** Changes below this are not worth another layout pass. */
const STORY_FIT_TOLERANCE = 0.02;

const StickerScaleContext = createContext(1);

const SCALED_KEYS = [
  'fontSize',
  'lineHeight',
  'gap',
  'rowGap',
  'columnGap',
  'width',
  'height',
  'borderRadius',
  'borderWidth',
  'paddingHorizontal',
  'paddingVertical',
  'marginTop',
  'textShadowRadius',
] as const;

/** Content scale of the surrounding frame: 1 on stickers, larger on the story card. */
export function useStickerScale(): number {
  return useContext(StickerScaleContext);
}

/** Multiplies the size keys of a style by the sticker's content scale. */
function useScaledStyle<T extends ViewStyle | TextStyle>(style: StyleProp<T>): T {
  const scale = useContext(StickerScaleContext);
  const flat = { ...(StyleSheet.flatten(style) as T) };
  if (scale === 1) {
    return flat;
  }
  const record = flat as Record<string, unknown>;
  for (const key of SCALED_KEYS) {
    const value = record[key];
    if (typeof value === 'number') {
      record[key] = value * scale;
    }
  }
  return flat;
}

const STORY_BACKGROUNDS: Record<StickerVariant, [string, string]> = {
  light: [BRAND_INDIGO, BRAND_INDIGO_DEEP],
  dark: ['#F5F4FF', '#E3F8F1'],
};

/**
 * Layout shell of every sticker: content plus the brand bottom right.
 * The sticker format has no background anywhere — the PNG keeps its alpha
 * only if every layer stays transparent. The story card is the exception.
 */
export function StickerFrame({
  variant,
  format = 'sticker',
  storyPhotoUri = null,
  children,
}: {
  variant: StickerVariant;
  format?: StickerFormat;
  /** Local photo behind the story card (meal right after the scan). */
  storyPhotoUri?: string | null;
  children: ReactNode;
}) {
  const palette = STICKER_PALETTES[variant];
  if (format === 'story') {
    return (
      <StoryFrame variant={variant} photoUri={storyPhotoUri}>
        {children}
      </StoryFrame>
    );
  }
  return (
    <View style={styles.sticker}>
      {children}
      <View style={styles.brandGap}>
        <StickerBrand color={palette.muted} textShadow={palette.shadow} />
      </View>
    </View>
  );
}

/**
 * 1080 × 1920 card on the brand background. The content is scaled until it
 * fills about two thirds of the height, whatever the sticker type — between
 * 1× and 2× the sticker size.
 */
/** Scrim over a story photo so the type stays readable in both variants. */
const STORY_PHOTO_SCRIMS: Record<StickerVariant, [string, string]> = {
  light: ['rgba(0,0,0,0.15)', 'rgba(0,0,0,0.6)'],
  dark: ['rgba(255,255,255,0.2)', 'rgba(255,255,255,0.75)'],
};

function StoryFrame({
  variant,
  photoUri = null,
  children,
}: {
  variant: StickerVariant;
  photoUri?: string | null;
  children: ReactNode;
}) {
  const palette = STICKER_PALETTES[variant];
  const [scale, setScale] = useState<number>(photoUri ? STORY_PHOTO_CONTENT_SCALE : STORY_CONTENT_SCALE);
  const passes = useRef(0);

  function onContentLayout(event: LayoutChangeEvent) {
    // On a photo the content stays compact at the bottom; the photo is the picture.
    if (photoUri) {
      return;
    }
    const next = nextStoryScale({
      scale,
      contentHeight: event.nativeEvent.layout.height,
      cardHeight: STORY_LAYOUT_HEIGHT,
    });
    if (Math.abs(next - scale) / scale <= STORY_FIT_TOLERANCE) {
      passes.current = 0;
      return;
    }
    if (passes.current >= STORY_FIT_PASSES) {
      return;
    }
    passes.current += 1;
    setScale(next);
  }

  const background = photoUri ? (
    <>
      <Image source={{ uri: photoUri }} style={StyleSheet.absoluteFill} contentFit="cover" />
      <LinearGradient
        colors={STORY_PHOTO_SCRIMS[variant]}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
    </>
  ) : null;

  return (
    <LinearGradient
      colors={STORY_BACKGROUNDS[variant]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[styles.story, photoUri ? styles.storyOnPhoto : null]}>
      {background}
      <View onLayout={onContentLayout}>
        {/* Remount per scale: iOS shrink-to-fit text keeps a stale size otherwise. */}
        <View key={scale}>
          <StickerScaleContext.Provider value={scale}>{children}</StickerScaleContext.Provider>
        </View>
      </View>
      <View style={styles.storyBrand}>
        <StickerBrand color={palette.muted} textShadow={palette.shadow} />
      </View>
    </LinearGradient>
  );
}

/** Sticker text ignores Dynamic Type: the export has a fixed layout. */
export function StickerText({ style, ...props }: TextProps) {
  return <Text allowFontScaling={false} style={useScaledStyle(style)} {...props} />;
}

/** Vertical stack whose spacing follows the content scale. */
export function StickerStack({ style, children }: { style?: StyleProp<ViewStyle>; children: ReactNode }) {
  return <View style={useScaledStyle(style)}>{children}</View>;
}

export function StickerBadge({ label }: { label: string }) {
  return (
    <StickerStack style={styles.badge}>
      <StickerText style={styles.badgeText}>{label}</StickerText>
    </StickerStack>
  );
}

function StickerDot({ style }: { style: StyleProp<ViewStyle> }) {
  return <View style={useScaledStyle(style)} />;
}

/** Dots for every rung; the reached one is larger and filled mint. */
export function StickerLadder({ level, palette }: { level: LadderPosition; palette: StickerPalette }) {
  return (
    <StickerStack style={styles.ladder}>
      {Array.from({ length: level.total }, (_, index) => {
        const step = index + 1;
        if (step === level.step) {
          return <StickerDot key={step} style={[styles.dotCurrent, { borderColor: palette.text }]} />;
        }
        return (
          <StickerDot
            key={step}
            style={[
              styles.dot,
              step < level.step
                ? { backgroundColor: palette.text }
                : { borderWidth: 2, borderColor: palette.faint },
            ]}
          />
        );
      })}
    </StickerStack>
  );
}

export function StickerLevelLine({
  level,
  palette,
}: {
  level: LadderPosition;
  palette: StickerPalette;
}) {
  const { t } = useTranslation();
  return (
    <StickerStack style={styles.levelLine}>
      <StickerText style={[styles.levelText, { color: palette.text }, palette.shadow]}>
        {t('share.level', { n: level.step, total: level.total })}
      </StickerText>
      <StickerLadder level={level} palette={palette} />
    </StickerStack>
  );
}

/** Half the content width minus a little air: the room of one stat value. */
const STAT_VALUE_WIDTH = (STICKER_LAYOUT_WIDTH - 48) / 2 - 8;
/** Width of a heavy tabular digit in em (generous, so a value never clips). */
const DIGIT_EM = 0.66;

export function StickerStat({
  label,
  value,
  palette,
}: {
  label: string;
  value: string;
  palette: StickerPalette;
}) {
  const scale = useStickerScale();
  // Shrink long values ourselves instead of adjustsFontSizeToFit, which kept
  // stale sizes on iOS while the story card re-fits.
  const base = styles.statValue.fontSize;
  const fitted = Math.min(base * scale, STAT_VALUE_WIDTH / (Math.max(1, value.length) * DIGIT_EM));
  const fontSize = fitted / scale;
  return (
    <View style={styles.stat}>
      <StickerText
        style={[
          styles.statValue,
          { fontSize, lineHeight: fontSize * (styles.statValue.lineHeight / base) },
          { color: palette.text },
          palette.shadow,
        ]}
        numberOfLines={1}>
        {value}
      </StickerText>
      <StickerText
        style={[styles.statLabel, { color: palette.muted }, palette.shadow]}
        numberOfLines={1}
        adjustsFontSizeToFit>
        {label}
      </StickerText>
    </View>
  );
}

export function StickerStatGrid({ children }: { children: ReactNode }) {
  return <StickerStack style={styles.statGrid}>{children}</StickerStack>;
}

export function formatStickerDate(dateKey: string, lang: string): string {
  const [y, m, d] = dateKey.split('-').map(Number);
  const date = new Date(y, (m ?? 1) - 1, d ?? 1);
  try {
    return date.toLocaleDateString(lang, { day: 'numeric', month: 'long', year: 'numeric' });
  } catch {
    return dateKey;
  }
}

export const stickerStyles = StyleSheet.create({
  stack: {
    gap: 14,
  },
  title: {
    fontSize: 30,
    lineHeight: 36,
    fontWeight: '800',
  },
  recapTitle: {
    fontSize: 36,
    lineHeight: 42,
    fontWeight: '800',
  },
  hero: {
    fontSize: 52,
    lineHeight: 58,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  sub: {
    fontSize: 18,
    lineHeight: 24,
    fontWeight: '600',
  },
  small: {
    fontSize: 14,
    lineHeight: 19,
    fontWeight: '500',
  },
  list: {
    gap: 6,
  },
  listRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 12,
  },
  listName: {
    flex: 1,
    fontSize: 17,
    fontWeight: '600',
  },
  listValue: {
    fontSize: 17,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
});

const styles = StyleSheet.create({
  sticker: {
    width: STICKER_LAYOUT_WIDTH,
    paddingHorizontal: 24,
    paddingVertical: 24,
  },
  story: {
    width: STICKER_LAYOUT_WIDTH,
    height: STORY_LAYOUT_HEIGHT,
    paddingHorizontal: 24,
    justifyContent: 'center',
  },
  storyOnPhoto: {
    // The photo stays visible above the content; the labels sit in the lower part.
    justifyContent: 'flex-end',
    paddingBottom: 96,
    overflow: 'hidden',
  },
  storyBrand: {
    position: 'absolute',
    right: 28,
    bottom: 36,
  },
  brandGap: {
    marginTop: 20,
  },
  badge: {
    alignSelf: 'flex-start',
    backgroundColor: BRAND_MINT,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  badgeText: {
    color: ANTHRACITE,
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  levelLine: {
    gap: 8,
  },
  levelText: {
    fontSize: 18,
    fontWeight: '700',
  },
  ladder: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  dot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  dotCurrent: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 3,
    backgroundColor: BRAND_MINT,
  },
  statGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    rowGap: 12,
  },
  stat: {
    width: '50%',
  },
  statValue: {
    fontSize: 34,
    lineHeight: 40,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  statLabel: {
    fontSize: 14,
    fontWeight: '600',
  },
});
