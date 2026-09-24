import { Ionicons } from '@expo/vector-icons';
import * as Sentry from '@sentry/react-native';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';

import { PillSegmentSwitcher } from '@/components/koli/pill-segment-switcher';
import { StickerView } from '@/components/share/stickers/StickerView';
import { GlassBottomSheet } from '@/components/shared/GlassBottomSheet';
import { BRAND_INDIGO, TEXT_SECONDARY } from '@/constants/brand';
import { trackShareStickerCreated } from '@/lib/analytics';
import {
  availableStickerOptions,
  DEFAULT_STICKER_OPTIONS,
  stickerAnalyticsType,
  type StickerAction,
  type StickerData,
  type StickerFormat,
  type StickerOptionKey,
  type StickerOptions,
  type StickerVariant,
} from '@/lib/share/sticker-data';
import {
  captureSticker,
  copySticker,
  saveStickerToPhotos,
  shareSticker,
  STICKER_EXPORT_WIDTH,
  STICKER_LAYOUT_WIDTH,
  STORY_LAYOUT_HEIGHT,
} from '@/lib/share/sticker-export';

/**
 * Whether a copied PNG keeps its alpha channel when pasted. Checked in the
 * simulator: iOS offers the copy as public.png with alpha (plus a JPEG).
 */
const CLIPBOARD_KEEPS_ALPHA = true;

/** Sheet side padding (GlassSheetSurface) on both sides. */
const SHEET_GUTTER = 48;
const PREVIEW_MAX_HEIGHT = 320;
/** The export copy sits this far left of the screen. */
const OFFSCREEN_LEFT = -4 * STICKER_LAYOUT_WIDTH;

type Status = 'saved' | 'copied' | 'permissionDenied' | 'failed' | null;

type ShareStickerSheetProps = {
  /** Sheet is open while this is set. */
  data: StickerData | null;
  onClose: () => void;
  /** Offer the 1080 × 1920 story card next to the transparent sticker (recaps). */
  allowStory?: boolean;
};

export function ShareStickerSheet({ data, onClose, allowStory = false }: ShareStickerSheetProps) {
  const { t } = useTranslation();
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const exportRef = useRef<View>(null);
  const [variant, setVariant] = useState<StickerVariant>('light');
  const [format, setFormat] = useState<StickerFormat>('sticker');
  const [options, setOptions] = useState<StickerOptions>(DEFAULT_STICKER_OPTIONS);
  const [layoutHeight, setLayoutHeight] = useState(0);
  const [busy, setBusy] = useState<StickerAction | null>(null);
  const [status, setStatus] = useState<Status>(null);

  const visible = data != null;

  useEffect(() => {
    if (visible) {
      setStatus(null);
      setBusy(null);
    }
  }, [visible]);

  if (!data) {
    return null;
  }

  const activeFormat: StickerFormat = allowStory && data.kind === 'recap' ? format : 'sticker';
  const height = activeFormat === 'story' ? STORY_LAYOUT_HEIGHT : layoutHeight;
  const availableWidth = Math.min(windowWidth - SHEET_GUTTER, STICKER_LAYOUT_WIDTH);
  const scale =
    height > 0
      ? Math.min(availableWidth / STICKER_LAYOUT_WIDTH, PREVIEW_MAX_HEIGHT / height)
      : availableWidth / STICKER_LAYOUT_WIDTH;
  const previewHeight = height > 0 ? height * scale : 160;
  const previewWidth = STICKER_LAYOUT_WIDTH * scale;
  const optionKeys = availableStickerOptions(data);

  function resetStatus() {
    setStatus(null);
  }

  function toggleOption(key: StickerOptionKey) {
    setOptions((prev) => ({ ...prev, [key]: !prev[key] }));
    resetStatus();
  }

  async function run(action: StickerAction) {
    if (busy || !data) {
      return;
    }
    setBusy(action);
    setStatus(null);
    try {
      const fileUri = await captureSticker(exportRef, { width: STICKER_EXPORT_WIDTH });
      if (action === 'save') {
        if ((await saveStickerToPhotos(fileUri)) === 'permission_denied') {
          setStatus('permissionDenied');
          return;
        }
      } else if (action === 'copy') {
        await copySticker(fileUri);
      } else {
        await shareSticker(fileUri);
      }
      trackShareStickerCreated({ type: stickerAnalyticsType(data), variant, action });
      setStatus(action === 'save' ? 'saved' : action === 'copy' ? 'copied' : null);
    } catch (error) {
      Sentry.captureException(error);
      setStatus('failed');
    } finally {
      setBusy(null);
    }
  }

  const sticker = (
    <StickerView data={data} variant={variant} options={options} format={activeFormat} />
  );

  return (
    <GlassBottomSheet visible={visible} onClose={onClose} maxHeightRatio={0.92}>
      {/* Export copy: full layout size, off screen, no background anywhere. */}
      <View pointerEvents="none" style={styles.exportLayer}>
        <View
          ref={exportRef}
          collapsable={false}
          onLayout={(event) => setLayoutHeight(event.nativeEvent.layout.height)}>
          {sticker}
        </View>
      </View>

      <ScrollView
        style={{ maxHeight: windowHeight * 0.85 }}
        showsVerticalScrollIndicator={false}
        bounces={false}>
        <Text style={styles.title}>{t('share.title')}</Text>

        <View
          pointerEvents="none"
          style={[
            styles.preview,
            // The dark backdrop shows off the light sticker and vice versa.
            activeFormat === 'sticker' && variant === 'light'
              ? styles.previewOnDark
              : styles.previewOnLight,
            { height: previewHeight + (activeFormat === 'sticker' ? 24 : 0) },
          ]}>
          <View style={{ width: previewWidth, height: previewHeight }}>
            <View
              style={{
                position: 'absolute',
                width: STICKER_LAYOUT_WIDTH,
                left: (previewWidth - STICKER_LAYOUT_WIDTH) / 2,
                top: (previewHeight - (height || previewHeight)) / 2,
                transform: [{ scale }],
              }}>
              {sticker}
            </View>
          </View>
        </View>

        <View style={styles.controls}>
          {allowStory && data.kind === 'recap' ? (
            <PillSegmentSwitcher
              compact
              value={format}
              onChange={(next) => {
                setFormat(next);
                resetStatus();
              }}
              segments={[
                { id: 'sticker', label: t('share.format.sticker'), testID: 'share.format.sticker' },
                { id: 'story', label: t('share.format.story'), testID: 'share.format.story' },
              ]}
            />
          ) : null}
          <PillSegmentSwitcher
            compact
            value={variant}
            onChange={(next) => {
              setVariant(next);
              resetStatus();
            }}
            segments={[
              { id: 'light', label: t('share.variant.light'), testID: 'share.variant.light' },
              { id: 'dark', label: t('share.variant.dark'), testID: 'share.variant.dark' },
            ]}
          />
          {optionKeys.map((key) => (
            <View key={key} style={styles.switchRow}>
              <Text style={styles.switchLabel}>{t(`share.options.${key}`)}</Text>
              <Switch
                testID={`share.option.${key}`}
                value={options[key]}
                onValueChange={() => toggleOption(key)}
                trackColor={{ true: BRAND_INDIGO }}
              />
            </View>
          ))}
        </View>

        <View style={styles.actions}>
          <ActionButton
            testID="share.action.save"
            icon="download-outline"
            label={t('share.actions.save')}
            busy={busy === 'save'}
            onPress={() => void run('save')}
          />
          {CLIPBOARD_KEEPS_ALPHA ? (
            <ActionButton
              testID="share.action.copy"
              icon="copy-outline"
              label={t('share.actions.copy')}
              busy={busy === 'copy'}
              onPress={() => void run('copy')}
            />
          ) : null}
          <ActionButton
            testID="share.action.share"
            icon="share-outline"
            label={t('share.actions.share')}
            busy={busy === 'share'}
            primary
            onPress={() => void run('share')}
          />
        </View>

        {status ? (
          <View style={styles.statusRow}>
            <Text
              testID="share.status"
              accessibilityLiveRegion="polite"
              style={[styles.status, status === 'failed' && styles.statusError]}>
              {t(`share.status.${status}`)}
            </Text>
            {status === 'permissionDenied' ? (
              <Pressable accessibilityRole="button" onPress={() => void Linking.openSettings()}>
                <Text style={styles.statusLink}>{t('share.openSettings')}</Text>
              </Pressable>
            ) : null}
          </View>
        ) : null}
      </ScrollView>
    </GlassBottomSheet>
  );
}

function ActionButton({
  testID,
  icon,
  label,
  busy,
  primary = false,
  onPress,
}: {
  testID: string;
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  busy: boolean;
  primary?: boolean;
  onPress: () => void;
}) {
  const color = primary ? '#FFFFFF' : BRAND_INDIGO;
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={[styles.action, primary && styles.actionPrimary]}>
      {busy ? (
        <ActivityIndicator color={color} />
      ) : (
        <Ionicons name={icon} size={20} color={color} />
      )}
      <Text style={[styles.actionLabel, { color }]} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  exportLayer: {
    position: 'absolute',
    top: 0,
    left: OFFSCREEN_LEFT,
    width: STICKER_LAYOUT_WIDTH,
  },
  title: {
    marginBottom: 12,
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
    textAlign: 'center',
  },
  preview: {
    borderRadius: 18,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewOnDark: {
    backgroundColor: '#2B2E36',
  },
  previewOnLight: {
    backgroundColor: '#ECEBF6',
  },
  controls: {
    marginTop: 16,
    gap: 10,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 2,
  },
  switchLabel: {
    fontSize: 15,
    color: '#111827',
  },
  actions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 16,
  },
  action: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 12,
    borderRadius: 14,
    backgroundColor: 'rgba(79,70,229,0.1)',
  },
  actionPrimary: {
    backgroundColor: BRAND_INDIGO,
  },
  actionLabel: {
    fontSize: 13,
    fontWeight: '600',
  },
  statusRow: {
    marginTop: 12,
    alignItems: 'center',
    gap: 4,
  },
  status: {
    fontSize: 14,
    color: TEXT_SECONDARY,
    textAlign: 'center',
  },
  statusError: {
    color: '#B42318',
  },
  statusLink: {
    fontSize: 14,
    fontWeight: '600',
    color: BRAND_INDIGO,
  },
});
