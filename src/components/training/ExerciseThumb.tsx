import { Image } from 'expo-image';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';

import { BRAND_INDIGO, GLASS_BORDER } from '@/constants/brand';
import { getCatalogExerciseImage } from '@/lib/workouts/catalog-images';
import { resolveExerciseName } from '@/lib/workouts/exercise-name';
import { getExerciseImageSignedUrl } from '@/lib/workouts/workouts-api';
import type { Exercise } from '@/lib/workouts/types';
import { useExerciseImageViewerStore } from '@/stores/exercise-image-viewer-store';

const SIZES = {
  sm: 40,
  md: 56,
  lg: 96,
} as const;

export type ExerciseThumbSize = keyof typeof SIZES;

type ExerciseThumbProps = {
  exercise: Exercise;
  size?: ExerciseThumbSize;
  onPressEnabled?: boolean;
};

export function ExerciseThumb({
  exercise,
  size = 'md',
  onPressEnabled = true,
}: ExerciseThumbProps) {
  const { i18n } = useTranslation();
  const openExerciseImage = useExerciseImageViewerStore((state) => state.openExerciseImage);
  const px = SIZES[size];
  const imagePath = exercise.imagePath;
  const { data: signedUrl } = useQuery({
    queryKey: ['exercise-image-signed', imagePath],
    enabled: Boolean(imagePath),
    staleTime: 50 * 60 * 1000,
    queryFn: () => getExerciseImageSignedUrl(imagePath),
  });

  const name = resolveExerciseName(exercise, i18n.language);
  const initial = (name.trim().charAt(0) || '?').toLocaleUpperCase(i18n.language);
  const catalogSource = getCatalogExerciseImage(exercise.imageAsset ?? exercise.catalogSlug);
  const source = signedUrl ? { uri: signedUrl } : catalogSource;

  const body = (
    <View style={[styles.frame, { width: px, height: px, borderRadius: 12 }]}>
      {source ? (
        <Image source={source} style={styles.image} contentFit="cover" />
      ) : (
        <View style={styles.fallback}>
          <Text style={[styles.fallbackLetter, size === 'lg' && styles.fallbackLetterLg]}>
            {initial}
          </Text>
        </View>
      )}
    </View>
  );

  if (!onPressEnabled) {
    return body;
  }

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={name}
      onPress={() => openExerciseImage(exercise)}
      style={({ pressed }) => [pressed && styles.pressed]}>
      {body}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  frame: {
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: GLASS_BORDER,
    backgroundColor: 'rgba(79, 70, 229, 0.06)',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  fallback: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fallbackLetter: {
    fontSize: 18,
    fontWeight: '700',
    color: BRAND_INDIGO,
  },
  fallbackLetterLg: {
    fontSize: 36,
  },
  pressed: {
    opacity: 0.85,
  },
});
