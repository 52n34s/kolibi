import { Image } from 'expo-image';
import { useTranslation } from 'react-i18next';
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import { useQuery } from '@tanstack/react-query';
import { runOnJS } from 'react-native-reanimated';

import { GLASS_SURFACE } from '@/components/ui/glass-styles';
import { BRAND_INDIGO, TEXT_SECONDARY, TEXT_TERTIARY } from '@/constants/brand';
import { getCatalogExerciseImage } from '@/lib/workouts/catalog-images';
import { resolveExerciseName } from '@/lib/workouts/exercise-name';
import { getExerciseImageSignedUrl } from '@/lib/workouts/workouts-api';
import type { Exercise } from '@/lib/workouts/types';
import { useExerciseImageViewerStore } from '@/stores/exercise-image-viewer-store';

type ExerciseImageViewerHostProps = {
  /** When true, render as absolute overlay (inside a sheet modal). */
  inline?: boolean;
};

function useExerciseImageSource(exercise: Exercise | null) {
  const imagePath = exercise?.imagePath ?? null;
  const { data: signedUrl } = useQuery({
    queryKey: ['exercise-image-signed', imagePath],
    enabled: Boolean(imagePath),
    staleTime: 50 * 60 * 1000,
    queryFn: () => getExerciseImageSignedUrl(imagePath),
  });

  if (!exercise) {
    return null;
  }
  if (signedUrl) {
    return { uri: signedUrl };
  }
  const catalog = getCatalogExerciseImage(exercise.imageAsset ?? exercise.catalogSlug);
  if (catalog) {
    return catalog;
  }
  return null;
}

function ViewerBody({
  exercise,
  onClose,
}: {
  exercise: Exercise;
  onClose: () => void;
}) {
  const { t, i18n } = useTranslation();
  const { height: windowHeight } = useWindowDimensions();
  const source = useExerciseImageSource(exercise);
  const name = resolveExerciseName(exercise, i18n.language);
  const initial = (name.trim().charAt(0) || '?').toLocaleUpperCase(i18n.language);

  const pan = Gesture.Pan()
    .onEnd((event) => {
      'worklet';
      if (event.translationY > 80 || event.velocityY > 800) {
        runOnJS(onClose)();
      }
    });

  return (
    <GestureDetector gesture={pan}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('training.imageViewer.close')}
        onPress={onClose}
        style={[styles.backdrop, { minHeight: windowHeight }]}>
        <Pressable
          onPress={(event) => event.stopPropagation()}
          style={styles.card}>
          <View style={styles.imageWrap}>
            {source ? (
              <Image source={source} style={styles.image} contentFit="contain" />
            ) : (
              <View style={styles.placeholder}>
                <Text style={styles.placeholderLetter}>{initial}</Text>
              </View>
            )}
          </View>
          <Text style={styles.name} numberOfLines={2}>
            {name}
          </Text>
          {exercise.note ? (
            <Text style={styles.note}>{exercise.note}</Text>
          ) : null}
          <Text style={styles.hint}>{t('training.imageViewer.dismissHint')}</Text>
        </Pressable>
      </Pressable>
    </GestureDetector>
  );
}

/**
 * Global or inline exercise image viewer.
 * Use `inline` inside GlassBottomSheet; root host uses a Modal when no sheet is open.
 */
export function ExerciseImageViewerHost({ inline = false }: ExerciseImageViewerHostProps) {
  const exercise = useExerciseImageViewerStore((state) => state.exercise);
  const sheetModalDepth = useExerciseImageViewerStore((state) => state.sheetModalDepth);
  const closeExerciseImage = useExerciseImageViewerStore((state) => state.closeExerciseImage);

  const shouldShow = exercise != null && (inline ? sheetModalDepth > 0 : sheetModalDepth === 0);

  if (!shouldShow || !exercise) {
    return null;
  }

  if (inline) {
    return (
      <View style={styles.inlineRoot} pointerEvents="box-none">
        <ViewerBody exercise={exercise} onClose={closeExerciseImage} />
      </View>
    );
  }

  return (
    <Modal
      transparent
      visible
      animationType="fade"
      onRequestClose={closeExerciseImage}>
      <GestureHandlerRootView style={styles.modalGestureRoot}>
        <ViewerBody exercise={exercise} onClose={closeExerciseImage} />
      </GestureHandlerRootView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalGestureRoot: {
    flex: 1,
  },
  inlineRoot: {
    ...StyleSheet.absoluteFill,
    zIndex: 100,
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.72)',
    justifyContent: 'center',
    paddingHorizontal: 20,
    paddingVertical: 40,
  },
  card: {
    ...GLASS_SURFACE,
    borderRadius: 20,
    padding: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.96)',
  },
  imageWrap: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#FAFAFA',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  placeholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(79, 70, 229, 0.08)',
  },
  placeholderLetter: {
    fontSize: 64,
    fontWeight: '700',
    color: BRAND_INDIGO,
  },
  name: {
    marginTop: 14,
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
  },
  note: {
    marginTop: 6,
    fontSize: 14,
    color: TEXT_SECONDARY,
  },
  hint: {
    marginTop: 12,
    fontSize: 12,
    color: TEXT_TERTIARY,
    textAlign: 'center',
  },
});
