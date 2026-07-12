import { LinearGradient } from 'expo-linear-gradient';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { CompactSegmentToggle } from '@/components/settings/compact-segment-toggle';
import { GlassBottomSheet } from '@/components/shared/GlassBottomSheet';

type PhotoCountOption = '1' | '2' | '3';

type ScanOptionsSheetProps = {
  visible: boolean;
  onClose: () => void;
  onCapture: (photoCount: number) => void;
  onPickFromGallery: (photoCount: number) => void;
};

export function ScanOptionsSheet({
  visible,
  onClose,
  onCapture,
  onPickFromGallery,
}: ScanOptionsSheetProps) {
  const { t } = useTranslation();
  const [photoCount, setPhotoCount] = useState<PhotoCountOption>('1');

  function handleCapturePress() {
    onCapture(Number(photoCount));
    onClose();
  }

  function handleGalleryPress() {
    onPickFromGallery(Number(photoCount));
  }

  return (
    <GlassBottomSheet visible={visible} onClose={onClose}>
      <Text style={styles.title}>{t('home.scan.options.title')}</Text>

      <View style={styles.pillRow}>
        <CompactSegmentToggle
          variant="language"
          value={photoCount}
          onChange={(value) => setPhotoCount(value as PhotoCountOption)}
          segments={[
            { id: '1', label: t('home.scan.options.onePhoto') },
            { id: '2', label: t('home.scan.options.twoPhotos') },
            { id: '3', label: t('home.scan.options.threePhotos') },
          ]}
        />
      </View>

      <Text style={styles.referenceHint}>{t('home.scan.referenceObjectHint')}</Text>
      <Text style={styles.referenceHintSecondary}>
        {t('home.scan.referenceObjectHintMultiPhoto')}
      </Text>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('home.scan.options.captureCta')}
        style={styles.ctaShell}
        onPress={handleCapturePress}>
        <LinearGradient
          colors={['#4F46E5', '#7CE7C7']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.ctaGradient}>
          <Text style={styles.ctaLabel}>{t('home.scan.options.captureCta')}</Text>
        </LinearGradient>
      </Pressable>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('home.scan.options.chooseFromGallery')}
        style={styles.secondaryButton}
        onPress={handleGalleryPress}>
        <Text style={styles.secondaryButtonLabel}>{t('home.scan.options.chooseFromGallery')}</Text>
      </Pressable>
    </GlassBottomSheet>
  );
}

const styles = StyleSheet.create({
  title: {
    marginBottom: 16,
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
    textAlign: 'center',
  },
  pillRow: {
    alignItems: 'center',
    marginBottom: 12,
  },
  referenceHint: {
    marginBottom: 6,
    fontSize: 13,
    lineHeight: 18,
    color: '#6B7280',
    textAlign: 'center',
  },
  referenceHintSecondary: {
    marginBottom: 14,
    fontSize: 13,
    lineHeight: 18,
    color: '#6B7280',
    textAlign: 'center',
  },
  ctaShell: {
    height: 48,
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 10,
  },
  ctaGradient: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    height: 48,
  },
  ctaLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  secondaryButton: {
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(79, 70, 229, 0.1)',
  },
  secondaryButtonLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#4F46E5',
  },
});
