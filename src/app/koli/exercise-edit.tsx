import { Ionicons } from '@expo/vector-icons';
import * as Sentry from '@sentry/react-native';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { Href, Stack, router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Alert,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';

import { HomeLayout, useMeshScreenInsets } from '@/components/home/home-layout';
import { OnboardingField } from '@/components/onboarding/onboarding-field';
import { SettingsBackButton } from '@/components/settings/settings-back-button';
import { NumberInputAccessory } from '@/components/ui/keyboard-accessory';
import {
  BRAND_INDIGO,
  CHIP_BORDER,
  CHIP_SURFACE_SELECTED,
  TEXT_SECONDARY,
  TEXT_TERTIARY,
} from '@/constants/brand';
import { useKeyboardHeight } from '@/hooks/use-keyboard-height';
import { newId } from '@/lib/id';
import { getCatalogExerciseImage } from '@/lib/workouts/catalog-images';
import { resolveExerciseName } from '@/lib/workouts/exercise-name';
import { workoutQueryKeys } from '@/lib/workouts/query-keys';
import type { Exercise } from '@/lib/workouts/types';
import {
  archiveExercise,
  createExercise,
  fetchExercises,
  getExerciseImageSignedUrl,
  updateExercise,
  uploadExerciseImage,
} from '@/lib/workouts/workouts-api';
import { useAuthStore } from '@/stores/auth-store';

/** Weighted kind UI stays hidden until a later block. */
const SHOW_WEIGHTED_EXERCISES = false;

const NAME_MAX = 40;
const NOTE_MAX = 200;
const DEFAULT_SETS = 3;
const DEFAULT_REPS = 10;
const DEFAULT_SECONDS = 30;
const DEFAULT_REST_WHEN_CUSTOM = 90;

type Draft = {
  name: string;
  kind: 'reps' | 'time';
  perSide: boolean;
  sets: string;
  reps: string;
  seconds: string;
  useDefaultRest: boolean;
  rest: string;
  note: string;
};

function emptyDraft(): Draft {
  return {
    name: '',
    kind: 'reps',
    perSide: false,
    sets: String(DEFAULT_SETS),
    reps: String(DEFAULT_REPS),
    seconds: String(DEFAULT_SECONDS),
    useDefaultRest: true,
    rest: String(DEFAULT_REST_WHEN_CUSTOM),
    note: '',
  };
}

function draftFromExercise(exercise: Exercise, lang: string): Draft {
  const kind: 'reps' | 'time' = exercise.kind === 'time' ? 'time' : 'reps';
  return {
    name: resolveExerciseName(exercise, lang),
    kind,
    perSide: exercise.perSide,
    sets: String(exercise.defaultSets || DEFAULT_SETS),
    reps: String(exercise.defaultReps ?? DEFAULT_REPS),
    seconds: String(exercise.defaultSeconds ?? DEFAULT_SECONDS),
    useDefaultRest: exercise.defaultRestSeconds == null,
    rest: String(exercise.defaultRestSeconds ?? DEFAULT_REST_WHEN_CUSTOM),
    note: exercise.note ?? '',
  };
}

export default function ExerciseEditScreen() {
  const { t, i18n } = useTranslation();
  const { contentTopPadding } = useMeshScreenInsets();
  const keyboardHeight = useKeyboardHeight();
  const queryClient = useQueryClient();
  const userId = useAuthStore((s) => s.session?.user?.id);
  const params = useLocalSearchParams<{ id?: string; readonly?: string }>();
  const paramId = typeof params.id === 'string' ? params.id : undefined;
  const readonly = params.readonly === '1' || params.readonly === 'true';

  const [exerciseId, setExerciseId] = useState<string | undefined>(paramId);
  const [draft, setDraft] = useState<Draft>(emptyDraft());
  const [initialized, setInitialized] = useState(!paramId);
  const [pendingImageUri, setPendingImageUri] = useState<string | null>(null);
  const [removeRemoteImage, setRemoveRemoteImage] = useState(false);
  const [uploadFailed, setUploadFailed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [copying, setCopying] = useState(false);

  const exercisesQuery = useQuery({
    queryKey: userId ? workoutQueryKeys.exercises(userId) : ['workout-exercises'],
    enabled: Boolean(userId) && Boolean(paramId),
    staleTime: 60 * 1000,
    queryFn: () => fetchExercises(),
  });

  const exercise = useMemo(
    () => exercisesQuery.data?.find((row) => row.id === (exerciseId ?? paramId)),
    [exercisesQuery.data, exerciseId, paramId],
  );

  const isOwn = exercise?.userId != null;
  const isReadonly = Boolean(readonly && exercise && !isOwn);
  const isNew = !exerciseId && !paramId;

  useEffect(() => {
    setExerciseId(paramId);
    setInitialized(!paramId);
    setPendingImageUri(null);
    setRemoveRemoteImage(false);
    setUploadFailed(false);
    if (!paramId) {
      setDraft(emptyDraft());
    }
  }, [paramId]);

  useEffect(() => {
    if (!paramId) {
      setInitialized(true);
      return;
    }
    if (!exercise || initialized) {
      return;
    }
    setDraft(draftFromExercise(exercise, i18n.language));
    setExerciseId(exercise.id);
    setInitialized(true);
  }, [exercise, i18n.language, initialized, paramId]);

  const { data: signedUrl } = useQuery({
    queryKey: ['exercise-image-signed', exercise?.imagePath],
    enabled: Boolean(exercise?.imagePath) && !removeRemoteImage,
    staleTime: 50 * 60 * 1000,
    queryFn: () => getExerciseImageSignedUrl(exercise!.imagePath),
  });

  const catalogSource = getCatalogExerciseImage(
    exercise?.imageAsset ?? exercise?.catalogSlug ?? null,
  );
  const previewUri =
    pendingImageUri ??
    (!removeRemoteImage ? signedUrl : null) ??
    null;

  async function invalidateExercises() {
    if (!userId) {
      return;
    }
    await queryClient.invalidateQueries({ queryKey: workoutQueryKeys.exercises(userId) });
  }

  async function openAppSettings() {
    try {
      await Linking.openSettings();
    } catch (error) {
      Sentry.captureException(error);
      Alert.alert(
        t('training.exerciseEdit.openSettingsFailedTitle'),
        t('training.exerciseEdit.openSettingsFailedMessage'),
      );
    }
  }

  function pickImage() {
    if (isReadonly) {
      return;
    }
    Alert.alert(t('training.exerciseEdit.imageTitle'), undefined, [
      {
        text: t('training.exerciseEdit.imageCamera'),
        onPress: () => void launchPicker('camera'),
      },
      {
        text: t('training.exerciseEdit.imageLibrary'),
        onPress: () => void launchPicker('library'),
      },
      { text: t('settings.common.cancel'), style: 'cancel' },
    ]);
  }

  async function launchPicker(source: 'camera' | 'library') {
    const permission =
      source === 'camera'
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permission.granted) {
      Alert.alert(
        t('training.exerciseEdit.permissionTitle'),
        t('training.exerciseEdit.permissionMessage'),
        [
          { text: t('settings.common.cancel'), style: 'cancel' },
          {
            text: t('training.exerciseEdit.openSettings'),
            onPress: () => void openAppSettings(),
          },
        ],
      );
      return;
    }

    const result =
      source === 'camera'
        ? await ImagePicker.launchCameraAsync({
            allowsEditing: true,
            aspect: [1, 1],
            quality: 0.85,
          })
        : await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ['images'],
            allowsEditing: true,
            aspect: [1, 1],
            quality: 0.85,
          });

    if (result.canceled || !result.assets[0]) {
      return;
    }

    setPendingImageUri(result.assets[0].uri);
    setRemoveRemoteImage(false);
    setUploadFailed(false);
  }

  function clearImage() {
    setPendingImageUri(null);
    setRemoveRemoteImage(true);
    setUploadFailed(false);
  }

  function parsePositiveInt(raw: string, fallback: number): number {
    const n = Number(raw.trim().replace(',', '.'));
    if (!Number.isFinite(n) || n < 1) {
      return fallback;
    }
    return Math.round(n);
  }

  async function tryUpload(id: string, localUri: string): Promise<boolean> {
    try {
      await uploadExerciseImage({ exerciseId: id, localUri });
      setPendingImageUri(null);
      setUploadFailed(false);
      return true;
    } catch (error) {
      Sentry.captureException(error);
      setUploadFailed(true);
      Alert.alert(
        t('settings.errors.title'),
        t('training.exerciseEdit.uploadFailed'),
      );
      return false;
    }
  }

  async function handleSave() {
    if (saving || isReadonly) {
      return;
    }
    const name = draft.name.trim();
    if (name.length < 1 || name.length > NAME_MAX) {
      Alert.alert(t('settings.errors.title'), t('training.exerciseEdit.nameInvalid'));
      return;
    }

    const sets = parsePositiveInt(draft.sets, DEFAULT_SETS);
    const reps = draft.kind === 'reps' ? parsePositiveInt(draft.reps, DEFAULT_REPS) : null;
    const seconds =
      draft.kind === 'time' ? parsePositiveInt(draft.seconds, DEFAULT_SECONDS) : null;
    const restSeconds = draft.useDefaultRest
      ? null
      : parsePositiveInt(draft.rest, DEFAULT_REST_WHEN_CUSTOM);
    const note = draft.note.trim().slice(0, NOTE_MAX) || null;
    const lang = i18n.language.split('-')[0] ?? 'de';

    setSaving(true);
    try {
      if (!exerciseId) {
        const id = newId();
        const created = await createExercise({
          id,
          names: { [lang]: name },
          kind: draft.kind,
          perSide: draft.perSide,
          defaultSets: sets,
          defaultReps: reps,
          defaultSeconds: seconds,
          defaultRestSeconds: restSeconds,
          note,
        });
        setExerciseId(created.id);

        if (pendingImageUri) {
          const ok = await tryUpload(created.id, pendingImageUri);
          await invalidateExercises();
          if (!ok) {
            return;
          }
        } else {
          await invalidateExercises();
        }
        router.back();
        return;
      }

      const names = { ...(exercise?.names ?? {}), [lang]: name };
      await updateExercise(exerciseId, {
        names,
        kind: draft.kind,
        perSide: draft.perSide,
        defaultSets: sets,
        defaultReps: reps,
        defaultSeconds: seconds,
        defaultRestSeconds: restSeconds,
        note,
        ...(removeRemoteImage && !pendingImageUri
          ? { imagePath: null, imageAsset: null }
          : {}),
      });

      if (pendingImageUri) {
        const ok = await tryUpload(exerciseId, pendingImageUri);
        await invalidateExercises();
        if (!ok) {
          return;
        }
      } else {
        await invalidateExercises();
      }
      router.back();
    } catch (error) {
      Sentry.captureException(error);
      Alert.alert(t('settings.errors.title'), t('training.exerciseEdit.saveFailed'));
    } finally {
      setSaving(false);
    }
  }

  async function handleRetryUpload() {
    if (!exerciseId || !pendingImageUri || saving) {
      return;
    }
    setSaving(true);
    try {
      const ok = await tryUpload(exerciseId, pendingImageUri);
      await invalidateExercises();
      if (ok) {
        router.back();
      }
    } finally {
      setSaving(false);
    }
  }

  function handleArchive() {
    if (!exerciseId || !isOwn) {
      return;
    }
    Alert.alert(
      t('training.exerciseEdit.archiveTitle'),
      t('training.exerciseEdit.archiveMessage'),
      [
        { text: t('settings.common.cancel'), style: 'cancel' },
        {
          text: t('training.exerciseEdit.archive'),
          style: 'destructive',
          onPress: () => void doArchive(),
        },
      ],
    );
  }

  async function doArchive() {
    if (!exerciseId) {
      return;
    }
    setSaving(true);
    try {
      await archiveExercise(exerciseId);
      await invalidateExercises();
      router.back();
    } catch (error) {
      Sentry.captureException(error);
      Alert.alert(t('settings.errors.title'), t('training.exerciseEdit.archiveFailed'));
    } finally {
      setSaving(false);
    }
  }

  async function handleCopy() {
    if (!exercise || copying) {
      return;
    }
    setCopying(true);
    try {
      const lang = i18n.language.split('-')[0] ?? 'de';
      const name = resolveExerciseName(exercise, i18n.language);
      const created = await createExercise({
        names: { ...exercise.names, [lang]: name },
        kind: exercise.kind === 'weighted' && !SHOW_WEIGHTED_EXERCISES ? 'reps' : exercise.kind,
        perSide: exercise.perSide,
        defaultSets: exercise.defaultSets,
        defaultReps: exercise.defaultReps,
        defaultSeconds: exercise.defaultSeconds,
        defaultRestSeconds: exercise.defaultRestSeconds,
        imageAsset: exercise.imageAsset,
        note: exercise.note,
      });
      await invalidateExercises();
      router.replace(`/koli/exercise-edit?id=${encodeURIComponent(created.id)}` as Href);
    } catch (error) {
      Sentry.captureException(error);
      Alert.alert(t('settings.errors.title'), t('training.exerciseEdit.copyFailed'));
    } finally {
      setCopying(false);
    }
  }

  const title = isNew
    ? t('training.exerciseEdit.createTitle')
    : isReadonly
      ? t('training.exerciseEdit.readonlyTitle')
      : t('training.exerciseEdit.editTitle');

  const loadingExisting = Boolean(paramId) && (exercisesQuery.isLoading || !initialized);

  return (
    <HomeLayout>
      <Stack.Screen options={{ headerShown: false }} />

      <View className="px-6" style={{ paddingTop: contentTopPadding }}>
        <SettingsBackButton label={t('training.catalog.back')} />
      </View>

      {exercisesQuery.isError && paramId ? (
        <View className="flex-1 items-center justify-center px-6">
          <Text className="text-center text-base text-gray-600">
            {t('training.catalog.loadFailed')}
          </Text>
        </View>
      ) : loadingExisting ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color={BRAND_INDIGO} />
        </View>
      ) : (
        <View className="flex-1" style={{ paddingBottom: keyboardHeight }}>
          <ScrollView
            className="flex-1 px-6"
            contentContainerStyle={{ paddingTop: 12, paddingBottom: 32 }}
            keyboardShouldPersistTaps="always">
            <Text className="mb-6 text-2xl font-bold text-gray-900">{title}</Text>

            <Pressable
              testID="training.exerciseEdit.image"
              accessibilityRole="button"
              disabled={isReadonly}
              onPress={pickImage}
              style={styles.imageBox}>
              {previewUri ? (
                <Image source={{ uri: previewUri }} style={styles.image} contentFit="cover" />
              ) : catalogSource && !removeRemoteImage ? (
                <Image source={catalogSource} style={styles.image} contentFit="cover" />
              ) : (
                <View style={styles.imagePlaceholder}>
                  <Ionicons name="camera-outline" size={28} color={TEXT_SECONDARY} />
                  <Text style={styles.imageHint}>{t('training.exerciseEdit.imageAdd')}</Text>
                </View>
              )}
            </Pressable>

            {!isReadonly && (previewUri || (exercise?.imagePath && !removeRemoteImage) || catalogSource) ? (
              <Pressable accessibilityRole="button" onPress={clearImage} style={styles.linkBtn}>
                <Text style={styles.linkDanger}>{t('training.exerciseEdit.imageRemove')}</Text>
              </Pressable>
            ) : null}

            {uploadFailed && pendingImageUri ? (
              <Pressable
                accessibilityRole="button"
                onPress={() => void handleRetryUpload()}
                style={styles.retryBtn}>
                <Text style={styles.retryText}>{t('training.exerciseEdit.uploadRetry')}</Text>
              </Pressable>
            ) : null}

            <Text style={styles.label}>{t('training.exerciseEdit.nameLabel')}</Text>
            <OnboardingField
              testID="training.exerciseEdit.name"
              value={draft.name}
              onChangeText={(name) => setDraft((d) => ({ ...d, name: name.slice(0, NAME_MAX) }))}
              editable={!isReadonly}
              maxLength={NAME_MAX}
              placeholder={t('training.exerciseEdit.namePlaceholder')}
            />
            <Text style={styles.counter}>
              {draft.name.length}/{NAME_MAX}
            </Text>

            <Text style={styles.label}>{t('training.exerciseEdit.kindLabel')}</Text>
            <View style={styles.kindRow}>
              {(
                [
                  ['reps', 'training.exerciseEdit.kindReps'],
                  ['time', 'training.exerciseEdit.kindTime'],
                ] as const
              ).map(([key, labelKey]) => {
                const active = draft.kind === key;
                return (
                  <Pressable
                    key={key}
                    testID={`training.exerciseEdit.kind.${key}`}
                    accessibilityRole="button"
                    disabled={isReadonly}
                    onPress={() => setDraft((d) => ({ ...d, kind: key }))}
                    style={[styles.chip, active && styles.chipActive]}>
                    <Text style={[styles.chipText, active && styles.chipTextActive]}>
                      {t(labelKey)}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <View style={styles.switchRow}>
              <Text style={styles.switchLabel}>{t('training.exerciseEdit.perSide')}</Text>
              <Switch
                testID="training.exerciseEdit.perSide"
                value={draft.perSide}
                disabled={isReadonly}
                onValueChange={(perSide) => setDraft((d) => ({ ...d, perSide }))}
                trackColor={{ false: '#D1D5DB', true: BRAND_INDIGO }}
                thumbColor="#FFFFFF"
              />
            </View>

            <Text style={styles.label}>{t('training.exerciseEdit.setsLabel')}</Text>
            <OnboardingField
              testID="training.exerciseEdit.sets"
              value={draft.sets}
              onChangeText={(sets) => setDraft((d) => ({ ...d, sets }))}
              editable={!isReadonly}
              keyboardType="number-pad"
            />

            {draft.kind === 'reps' ? (
              <>
                <Text style={styles.label}>{t('training.exerciseEdit.repsLabel')}</Text>
                <OnboardingField
                  testID="training.exerciseEdit.reps"
                  value={draft.reps}
                  onChangeText={(reps) => setDraft((d) => ({ ...d, reps }))}
                  editable={!isReadonly}
                  keyboardType="number-pad"
                />
              </>
            ) : (
              <>
                <Text style={styles.label}>{t('training.exerciseEdit.secondsLabel')}</Text>
                <OnboardingField
                  testID="training.exerciseEdit.seconds"
                  value={draft.seconds}
                  onChangeText={(seconds) => setDraft((d) => ({ ...d, seconds }))}
                  editable={!isReadonly}
                  keyboardType="number-pad"
                />
              </>
            )}

            <View style={styles.switchRow}>
              <Text style={styles.switchLabel}>{t('training.exerciseEdit.useDefaultRest')}</Text>
              <Switch
                value={draft.useDefaultRest}
                disabled={isReadonly}
                onValueChange={(useDefaultRest) =>
                  setDraft((d) => ({ ...d, useDefaultRest }))
                }
                trackColor={{ false: '#D1D5DB', true: BRAND_INDIGO }}
                thumbColor="#FFFFFF"
              />
            </View>

            {!draft.useDefaultRest ? (
              <>
                <Text style={styles.label}>{t('training.exerciseEdit.restLabel')}</Text>
                <OnboardingField
                  testID="training.exerciseEdit.rest"
                  value={draft.rest}
                  onChangeText={(rest) => setDraft((d) => ({ ...d, rest }))}
                  editable={!isReadonly}
                  keyboardType="number-pad"
                />
              </>
            ) : null}

            <Text style={styles.label}>{t('training.exerciseEdit.noteLabel')}</Text>
            <OnboardingField
              testID="training.exerciseEdit.note"
              value={draft.note}
              onChangeText={(note) =>
                setDraft((d) => ({ ...d, note: note.slice(0, NOTE_MAX) }))
              }
              editable={!isReadonly}
              maxLength={NOTE_MAX}
              multiline
              style={styles.note}
            />
            <Text style={styles.counter}>
              {draft.note.length}/{NOTE_MAX}
            </Text>
          </ScrollView>

          <View className="px-6 pb-8 gap-3">
            {isReadonly ? (
              <Pressable
                testID="training.exerciseEdit.copy"
                accessibilityRole="button"
                disabled={copying}
                onPress={() => void handleCopy()}
                style={[styles.primary, copying && styles.disabled]}>
                {copying ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.primaryText}>{t('training.exerciseEdit.copy')}</Text>
                )}
              </Pressable>
            ) : (
              <>
                <Pressable
                  testID="training.exerciseEdit.save"
                  accessibilityRole="button"
                  disabled={saving}
                  onPress={() => void handleSave()}
                  style={[styles.primary, saving && styles.disabled]}>
                  {saving ? (
                    <ActivityIndicator color="#FFFFFF" />
                  ) : (
                    <Text style={styles.primaryText}>{t('training.exerciseEdit.save')}</Text>
                  )}
                </Pressable>
                {isOwn ? (
                  <Pressable
                    testID="training.exerciseEdit.archive"
                    accessibilityRole="button"
                    disabled={saving}
                    onPress={handleArchive}>
                    <Text style={styles.archiveText}>{t('training.exerciseEdit.archive')}</Text>
                  </Pressable>
                ) : null}
              </>
            )}
          </View>
        </View>
      )}
      <NumberInputAccessory />
    </HomeLayout>
  );
}

const styles = StyleSheet.create({
  imageBox: {
    alignSelf: 'center',
    width: 120,
    height: 120,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: CHIP_BORDER,
    backgroundColor: 'rgba(79, 70, 229, 0.06)',
    marginBottom: 8,
  },
  image: {
    width: '100%',
    height: '100%',
  },
  imagePlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  imageHint: {
    fontSize: 12,
    color: TEXT_SECONDARY,
    fontWeight: '600',
  },
  linkBtn: {
    alignSelf: 'center',
    marginBottom: 16,
    paddingVertical: 4,
  },
  linkDanger: {
    color: '#B91C1C',
    fontWeight: '600',
    fontSize: 14,
  },
  retryBtn: {
    alignSelf: 'center',
    marginBottom: 12,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: 'rgba(79, 70, 229, 0.12)',
  },
  retryText: {
    color: BRAND_INDIGO,
    fontWeight: '700',
  },
  label: {
    marginBottom: 6,
    marginTop: 12,
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
  },
  counter: {
    marginTop: 4,
    fontSize: 12,
    color: TEXT_TERTIARY,
    textAlign: 'right',
  },
  kindRow: {
    flexDirection: 'row',
    gap: 8,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: CHIP_BORDER,
    backgroundColor: 'rgba(255,255,255,0.55)',
  },
  chipActive: {
    backgroundColor: CHIP_SURFACE_SELECTED,
    borderColor: BRAND_INDIGO,
  },
  chipText: {
    fontWeight: '600',
    color: TEXT_SECONDARY,
  },
  chipTextActive: {
    color: BRAND_INDIGO,
  },
  switchRow: {
    marginTop: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  switchLabel: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
  },
  note: {
    minHeight: 96,
    height: undefined,
    paddingTop: 12,
    paddingBottom: 12,
    textAlignVertical: 'top',
  },
  primary: {
    height: 48,
    borderRadius: 12,
    backgroundColor: BRAND_INDIGO,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 16,
  },
  disabled: {
    opacity: 0.5,
  },
  archiveText: {
    textAlign: 'center',
    color: '#B91C1C',
    fontWeight: '600',
    fontSize: 15,
    paddingVertical: 8,
  },
});
