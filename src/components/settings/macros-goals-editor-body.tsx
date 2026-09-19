import { Ionicons } from '@expo/vector-icons';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';

import { ONBOARDING_ACCENT } from '@/components/onboarding/onboarding-styles';
import { WeightGoalEtaMessage } from '@/components/weight-goal-eta-message';
import { TEXT_SECONDARY } from '@/constants/brand';
import { useHealthConnectedPreference } from '@/hooks/use-health-connected-preference';
import { useProfileSettings } from '@/hooks/use-profile-settings';
import {
  fetchMacroGoalEditorState,
  getCalorieGoalErrorMessage,
  logCalorieGoalSaveError,
  saveMacrosGoalsBundle,
} from '@/lib/calorie-goals';
import { parseDateOnly } from '@/lib/day-window';
import {
  calculateMaintenanceCalories,
  resolveCalorieSource,
} from '@/lib/onboarding';
import {
  resolveGoalDirectionFromCalories,
  type WeightGoalEtaInput,
} from '@/lib/weight-goal-eta';
import {
  deriveCarbsGRounded,
  isMacroValueDiverged,
  kcalFromMacrosRounded,
  MACRO_KCAL_TOLERANCE,
  MACROS_ADAPT_TO_TRAINING_PREFERENCE_KEY,
  MACROS_CARBS_UNLOCKED_PREFERENCE_KEY,
  resolveMacroSoftHints,
  wouldCarbsGoNegative,
} from '@/lib/macros-goals-editor-math';
import {
  computeEmpfohleneMakros,
  MacroEmpfehlungsZiel,
  MacroErnaehrungsform,
  mapEmpfehlungsZielToProfileGoal,
  mapProfileDietToErnaehrungsform,
  mapProfileGoalToEmpfehlungsZiel,
} from '@/lib/macro-recommendations';
import {
  isPartialNumericInput,
  NUMERIC_DONE_INPUT_PROPS,
  resolveNumericKeyboardType,
} from '@/lib/numeric-input';
import {
  getUserPreferenceOrDefault,
  setUserPreference,
} from '@/lib/user-preferences';

export type MacrosGoalsEditorActions = {
  canSave: boolean;
  isSaving: boolean;
  save: () => void;
};

type MacrosGoalsEditorBodyProps = {
  userId: string;
  onSaved?: () => void;
  hideActions?: boolean;
  onActionsChange?: (actions: MacrosGoalsEditorActions) => void;
};

type MacroKey = 'protein' | 'fat' | 'carbs';

const ZIEL_OPTIONS: MacroEmpfehlungsZiel[] = [
  MacroEmpfehlungsZiel.ABNEHMEN,
  MacroEmpfehlungsZiel.HALTEN,
  MacroEmpfehlungsZiel.MUSKELAUFBAU,
  MacroEmpfehlungsZiel.AUSDAUERLEISTUNG,
];

function parseGrams(value: string): number | null {
  const normalized = value.trim().replace(',', '.');
  if (normalized === '') {
    return null;
  }
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function gramsDraft(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) {
    return '';
  }
  return String(Math.round(value));
}

export function MacrosGoalsEditorBody({
  userId,
  onSaved,
  hideActions = false,
  onActionsChange,
}: MacrosGoalsEditorBodyProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { data: healthConnectedPreference = false } = useHealthConnectedPreference(userId);

  const [ziel, setZiel] = useState<MacroEmpfehlungsZiel>(MacroEmpfehlungsZiel.HALTEN);
  const [proteinDraft, setProteinDraft] = useState('');
  const [fatDraft, setFatDraft] = useState('');
  const [carbsDraft, setCarbsDraft] = useState('');
  const [fiberDraft, setFiberDraft] = useState('');
  const [carbsUnlocked, setCarbsUnlocked] = useState(false);
  const [adaptToTraining, setAdaptToTraining] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [inlineError, setInlineError] = useState<string | null>(null);
  const [initialized, setInitialized] = useState(false);
  /** True once the user edits anything vs loaded recommendations. */
  const [hasManualEdits, setHasManualEdits] = useState(false);

  const baselineRef = useRef<{
    weightKg: number | null;
    ziel: MacroEmpfehlungsZiel;
  } | null>(null);

  const { data: profileSettings, isLoading: profileLoading } = useProfileSettings(userId);
  const profileData = profileSettings?.profile;

  const { data: macroState, isLoading: macroLoading, refetch } = useQuery({
    queryKey: ['macro-goal-editor', userId],
    queryFn: () => fetchMacroGoalEditorState(userId),
  });

  const { data: prefs } = useQuery({
    queryKey: ['macros-goals-prefs', userId],
    queryFn: async () => {
      const [adapt, unlocked] = await Promise.all([
        getUserPreferenceOrDefault(userId, MACROS_ADAPT_TO_TRAINING_PREFERENCE_KEY, true),
        getUserPreferenceOrDefault(userId, MACROS_CARBS_UNLOCKED_PREFERENCE_KEY, false),
      ]);
      return { adaptToTraining: adapt, carbsUnlocked: unlocked };
    },
  });

  const weightKg = profileData?.latest_weight_kg ?? null;
  const targetWeightKg = profileData?.target_weight_kg ?? weightKg ?? 0;
  const heightCm = profileData?.height_cm ?? 0;
  const basisKcal = macroState?.dailyCalorieGoal ?? profileData?.daily_calorie_goal ?? 0;
  const diet =
    mapProfileDietToErnaehrungsform(profileData?.diet_preference) ??
    MacroErnaehrungsform.OMNIVOR;

  const proteinG = parseGrams(proteinDraft);
  const fatG = parseGrams(fatDraft);
  const carbsG = parseGrams(carbsDraft);
  const fiberG = parseGrams(fiberDraft);

  const recommended = useMemo(() => {
    if (!(basisKcal > 0) || !(weightKg != null && weightKg > 0) || !(heightCm > 0)) {
      return null;
    }
    return computeEmpfohleneMakros({
      ziel,
      ernaehrungsform: diet,
      gewichtKg: weightKg,
      zielgewichtKg: targetWeightKg > 0 ? targetWeightKg : weightKg,
      groesseCm: heightCm,
      basisKcal,
    });
  }, [basisKcal, diet, heightCm, targetWeightKg, weightKg, ziel]);

  const effectiveBasisKcal = useMemo(() => {
    if (carbsUnlocked && proteinG != null && fatG != null && carbsG != null) {
      return kcalFromMacrosRounded(proteinG, fatG, carbsG);
    }
    return basisKcal;
  }, [basisKcal, carbsG, carbsUnlocked, fatG, proteinG]);

  const macrosMatchRecommended = useMemo(() => {
    if (recommended == null || proteinG == null || fatG == null || carbsG == null) {
      return false;
    }
    return (
      !isMacroValueDiverged(proteinG, recommended.protein.wert) &&
      !isMacroValueDiverged(fatG, recommended.fett.wert) &&
      !isMacroValueDiverged(carbsG, recommended.kohlenhydrate.wert)
    );
  }, [carbsG, fatG, proteinG, recommended]);

  const showIndividuell = hasManualEdits && !macrosMatchRecommended;

  const softHints = useMemo(() => {
    if (proteinG == null || fatG == null || !(effectiveBasisKcal > 0)) {
      return [];
    }
    return resolveMacroSoftHints({
      proteinG,
      fatG,
      basisKcal: effectiveBasisKcal,
      weightKg,
    });
  }, [effectiveBasisKcal, fatG, proteinG, weightKg]);

  const carbsNegative = useMemo(() => {
    if (proteinG == null || fatG == null || !(effectiveBasisKcal > 0)) {
      return false;
    }
    if (carbsUnlocked) {
      return carbsG != null && carbsG < 0;
    }
    return wouldCarbsGoNegative({
      basisKcal: effectiveBasisKcal,
      proteinG,
      fatG,
    });
  }, [carbsG, carbsUnlocked, effectiveBasisKcal, fatG, proteinG]);

  const canSave =
    !isSaving &&
    !carbsNegative &&
    proteinG != null &&
    fatG != null &&
    carbsG != null &&
    carbsG >= 0 &&
    effectiveBasisKcal > 0 &&
    recommended != null;

  useEffect(() => {
    if (initialized || macroState == null || profileData == null || prefs == null) {
      return;
    }

    const mappedZiel =
      mapProfileGoalToEmpfehlungsZiel(profileData.goal_type) ?? MacroEmpfehlungsZiel.HALTEN;
    setZiel(mappedZiel);
    setCarbsUnlocked(prefs.carbsUnlocked);
    setAdaptToTraining(prefs.adaptToTraining);

    const seedBasis = macroState.dailyCalorieGoal;
    const seedRec =
      weightKg != null && heightCm > 0 && seedBasis > 0
        ? computeEmpfohleneMakros({
            ziel: mappedZiel,
            ernaehrungsform: diet,
            gewichtKg: weightKg,
            zielgewichtKg: targetWeightKg > 0 ? targetWeightKg : weightKg,
            groesseCm: heightCm,
            basisKcal: seedBasis,
          })
        : null;

    const proteinSeed = macroState.proteinG ?? seedRec?.protein.wert ?? null;
    const fatSeed = macroState.fatG ?? seedRec?.fett.wert ?? null;
    let carbsSeed = macroState.carbsG ?? seedRec?.kohlenhydrate.wert ?? null;
    if (
      !prefs.carbsUnlocked &&
      proteinSeed != null &&
      fatSeed != null &&
      seedBasis > 0
    ) {
      carbsSeed = Math.max(
        0,
        deriveCarbsGRounded({
          basisKcal: seedBasis,
          proteinG: Math.round(proteinSeed),
          fatG: Math.round(fatSeed),
        }),
      );
    }

    setProteinDraft(gramsDraft(proteinSeed));
    setFatDraft(gramsDraft(fatSeed));
    setCarbsDraft(gramsDraft(carbsSeed));
    setFiberDraft(gramsDraft(macroState.fiberG ?? seedRec?.ballaststoffe.wert));
    setHasManualEdits(macroState.macroGoalSource === 'custom');
    baselineRef.current = { weightKg, ziel: mappedZiel };
    setInitialized(true);
  }, [
    diet,
    heightCm,
    initialized,
    macroState,
    prefs,
    profileData,
    targetWeightKg,
    weightKg,
  ]);

  // Live-update locked carbs when protein/fat change.
  useEffect(() => {
    if (!initialized || carbsUnlocked || proteinG == null || fatG == null || !(basisKcal > 0)) {
      return;
    }
    const next = deriveCarbsGRounded({ basisKcal, proteinG, fatG });
    setCarbsDraft(String(Math.max(0, next)));
  }, [basisKcal, carbsUnlocked, fatG, initialized, proteinG]);

  const applyMakrosFromRecommendation = useCallback(
    (next: NonNullable<typeof recommended>, keys?: MacroKey[] | 'fiber') => {
      if (keys === 'fiber') {
        setFiberDraft(gramsDraft(next.ballaststoffe.wert));
        return;
      }
      const set = new Set(keys ?? ['protein', 'fat', 'carbs']);
      if (set.has('protein')) {
        setProteinDraft(gramsDraft(next.protein.wert));
      }
      if (set.has('fat')) {
        setFatDraft(gramsDraft(next.fett.wert));
      }
      if (set.has('carbs')) {
        setCarbsDraft(gramsDraft(next.kohlenhydrate.wert));
      }
      if (keys == null) {
        setFiberDraft(gramsDraft(next.ballaststoffe.wert));
        setHasManualEdits(false);
      }
    },
    [],
  );

  const applyRecommended = useCallback(
    (keys?: MacroKey[] | 'fiber') => {
      if (recommended == null) {
        return;
      }
      applyMakrosFromRecommendation(recommended, keys);
    },
    [applyMakrosFromRecommendation, recommended],
  );

  const computeRecommendedForZiel = useCallback(
    (activeZiel: MacroEmpfehlungsZiel) => {
      if (weightKg == null || !(heightCm > 0) || !(basisKcal > 0)) {
        return null;
      }
      return computeEmpfohleneMakros({
        ziel: activeZiel,
        ernaehrungsform: diet,
        gewichtKg: weightKg,
        zielgewichtKg: targetWeightKg > 0 ? targetWeightKg : weightKg,
        groesseCm: heightCm,
        basisKcal,
      });
    },
    [basisKcal, diet, heightCm, targetWeightKg, weightKg],
  );

  function requestRecalculate(nextZiel?: MacroEmpfehlungsZiel) {
    Alert.alert(
      t('settings.macrosGoals.recalculateTitle'),
      t('settings.macrosGoals.recalculateMessage'),
      [
        {
          text: t('settings.macrosGoals.recalculateDecline'),
          style: 'cancel',
          onPress: () => {
            if (nextZiel != null) {
              setZiel(nextZiel);
              setHasManualEdits(true);
            }
          },
        },
        {
          text: t('settings.macrosGoals.recalculateConfirm'),
          onPress: () => {
            if (nextZiel != null) {
              setZiel(nextZiel);
            }
            const activeZiel = nextZiel ?? ziel;
            const next = computeRecommendedForZiel(activeZiel);
            if (next == null) {
              return;
            }
            applyMakrosFromRecommendation(next);
            baselineRef.current = { weightKg, ziel: activeZiel };
          },
        },
      ],
    );
  }

  function handleZielPress(next: MacroEmpfehlungsZiel) {
    if (next === ziel) {
      return;
    }
    if (hasManualEdits && !macrosMatchRecommended) {
      requestRecalculate(next);
      return;
    }
    setZiel(next);
    const nextRec = computeRecommendedForZiel(next);
    if (nextRec != null) {
      applyMakrosFromRecommendation(nextRec);
    }
    baselineRef.current = { weightKg, ziel: next };
  }

  function handleCarbsPress() {
    if (carbsUnlocked) {
      return;
    }
    Alert.alert(
      t('settings.macrosGoals.unlockCarbsTitle'),
      t('settings.macrosGoals.unlockCarbsMessage'),
      [
        { text: t('settings.common.cancel'), style: 'cancel' },
        {
          text: t('settings.macrosGoals.unlockCarbsConfirm'),
          onPress: () => {
            setCarbsUnlocked(true);
            setHasManualEdits(true);
            void setUserPreference(userId, MACROS_CARBS_UNLOCKED_PREFERENCE_KEY, true);
          },
        },
      ],
    );
  }

  async function handleAdaptToggle(next: boolean) {
    setAdaptToTraining(next);
    try {
      await setUserPreference(userId, MACROS_ADAPT_TO_TRAINING_PREFERENCE_KEY, next);
      await queryClient.invalidateQueries({ queryKey: ['macros-goals-prefs', userId] });
      await queryClient.invalidateQueries({ queryKey: ['macros-adapt-to-training', userId] });
      await queryClient.invalidateQueries({ queryKey: ['home-dashboard', userId] });
    } catch (error) {
      console.error('[MacrosGoals] adapt toggle failed:', error);
      setAdaptToTraining(!next);
    }
  }

  async function handleSave() {
    if (!canSave || proteinG == null || fatG == null || carbsG == null || recommended == null) {
      return;
    }

    setIsSaving(true);
    setInlineError(null);
    try {
      await saveMacrosGoalsBundle({
        userId,
        dailyCalorieGoal: effectiveBasisKcal,
        calorieGoalIsCustom: carbsUnlocked,
        proteinG: Math.round(proteinG),
        fatG: Math.round(fatG),
        carbsG: Math.round(carbsG),
        fiberG: fiberG == null ? recommended.ballaststoffe.wert : Math.round(fiberG),
        proteinRefKg: recommended.proteinBezugsgewichtKg,
        goalType: mapEmpfehlungsZielToProfileGoal(ziel, profileData?.goal_type),
        macroGoalSource:
          carbsUnlocked || hasManualEdits || !macrosMatchRecommended
            ? 'custom'
            : 'calculated',
      });
      await setUserPreference(userId, MACROS_CARBS_UNLOCKED_PREFERENCE_KEY, carbsUnlocked);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['macro-goal-editor', userId] }),
        queryClient.invalidateQueries({ queryKey: ['home-dashboard', userId] }),
        queryClient.invalidateQueries({ queryKey: ['profile-settings', userId] }),
        queryClient.invalidateQueries({ queryKey: ['calorie-goal-for-date', userId] }),
      ]);
      if (onSaved) {
        onSaved();
      } else {
        await refetch();
      }
    } catch (error) {
      logCalorieGoalSaveError('macros-goals-editor', error);
      setInlineError(
        getCalorieGoalErrorMessage(error, t('settings.macrosGoals.saveFailed')),
      );
    } finally {
      setIsSaving(false);
    }
  }

  const saveRef = useRef(handleSave);
  saveRef.current = handleSave;

  useEffect(() => {
    onActionsChange?.({
      canSave,
      isSaving,
      save: () => {
        void saveRef.current();
      },
    });
  }, [canSave, isSaving, onActionsChange]);

  // Weight change prompt
  useEffect(() => {
    if (!initialized || baselineRef.current == null) {
      return;
    }
    if (
      hasManualEdits &&
      weightKg != null &&
      baselineRef.current.weightKg != null &&
      Math.abs(weightKg - baselineRef.current.weightKg) >= 0.05
    ) {
      requestRecalculate();
      baselineRef.current = { ...baselineRef.current, weightKg };
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only react to weight changes
  }, [weightKg]);

  const kcalSum =
    proteinG != null && fatG != null && carbsG != null
      ? kcalFromMacrosRounded(proteinG, fatG, carbsG)
      : null;
  const kcalDelta = kcalSum != null ? kcalSum - basisKcal : null;
  const calorieGoalShifted =
    kcalDelta != null && Math.abs(kcalDelta) > MACRO_KCAL_TOLERANCE;

  const macrosWeightEtaInput = useMemo((): WeightGoalEtaInput | null => {
    if (!calorieGoalShifted || kcalSum == null || weightKg == null || weightKg <= 0) {
      return null;
    }
    const target = profileData?.target_weight_kg;
    if (target == null || !(target > 0)) {
      return null;
    }
    if (
      profileData?.birth_date == null ||
      profileData.activity_level == null ||
      profileData.height_cm == null
    ) {
      return null;
    }
    const birthDate = parseDateOnly(profileData.birth_date);
    const maintenance = calculateMaintenanceCalories({
      biologicalSex: profileData.biological_sex ?? 'prefer_not_to_say',
      birthDate,
      heightCm: profileData.height_cm,
      weightKg,
      activityLevel: profileData.activity_level,
      calorieSource: resolveCalorieSource(healthConnectedPreference === true),
    });
    const direction = resolveGoalDirectionFromCalories({
      goalType: mapEmpfehlungsZielToProfileGoal(ziel, profileData?.goal_type),
      dailyCalorieGoal: kcalSum,
      maintenanceCalories: maintenance,
    });
    if (direction === 'none') {
      return null;
    }
    return {
      logs: [],
      targetWeightKg: target,
      currentWeightKg: weightKg,
      dailyCalorieGoal: kcalSum,
      maintenanceCalories: maintenance,
      goalDirection: direction,
    };
  }, [
    calorieGoalShifted,
    healthConnectedPreference,
    kcalSum,
    profileData?.activity_level,
    profileData?.biological_sex,
    profileData?.birth_date,
    profileData?.height_cm,
    profileData?.target_weight_kg,
    weightKg,
    ziel,
  ]);

  if (profileLoading || macroLoading || !initialized) {
    return (
      <View className="items-center justify-center py-10">
        <ActivityIndicator color={ONBOARDING_ACCENT} />
      </View>
    );
  }

  if (macroState == null || !(basisKcal > 0) || recommended == null) {
    return (
      <View className="py-4">
        <Text className="text-sm text-gray-500">{t('settings.macroGoal.needsCalorieGoal')}</Text>
      </View>
    );
  }

  function renderMacroRow(params: {
    macroKey: MacroKey;
    label: string;
    draft: string;
    setDraft: (v: string) => void;
    recommendedG: number;
    herleitung: string;
    locked?: boolean;
  }) {
    const parsed = parseGrams(params.draft);
    const diverged =
      parsed != null && isMacroValueDiverged(parsed, params.recommendedG);

    return (
      <View className="mb-5">
        <Text className="mb-2 text-sm font-medium text-gray-700">{params.label}</Text>
        <Pressable onPress={params.locked ? handleCarbsPress : undefined}>
          <View className="relative">
            <TextInput
              editable={!params.locked}
              pointerEvents={params.locked ? 'none' : 'auto'}
              keyboardType={resolveNumericKeyboardType('number-pad')}
              value={params.draft}
              onChangeText={(text) => {
                if (params.locked) {
                  return;
                }
                if (!isPartialNumericInput(text, false)) {
                  return;
                }
                params.setDraft(text);
                setHasManualEdits(true);
              }}
              placeholder="0"
              placeholderTextColor="#9CA3AF"
              style={{
                opacity: params.locked ? 0.55 : 1,
              }}
              className="h-11 w-full self-stretch rounded-xl border border-gray-200 bg-white px-3 pr-10 text-base text-gray-900"
              {...NUMERIC_DONE_INPUT_PROPS}
            />
            {params.locked ? (
              <View className="absolute right-3 top-0 bottom-0 justify-center">
                <Ionicons name="lock-closed" size={16} color={TEXT_SECONDARY} />
              </View>
            ) : null}
          </View>
        </Pressable>
        {diverged && !(params.locked && params.macroKey === 'carbs') ? (
          <Pressable
            accessibilityRole="button"
            onPress={() => {
              applyRecommended([params.macroKey]);
            }}
            className="mt-1.5 self-start">
            <Text className="text-sm text-indigo-600">
              {t('settings.macrosGoals.recommendedReset', {
                value: Math.round(params.recommendedG),
              })}
            </Text>
          </Pressable>
        ) : (
          <Text className="mt-1.5 text-sm" style={{ color: TEXT_SECONDARY }}>
            {t('settings.macrosGoals.recommended', {
              value: Math.round(params.recommendedG),
            })}
          </Text>
        )}
        <Text className="mt-1 text-xs" style={{ color: TEXT_SECONDARY }}>
          {params.herleitung}
        </Text>
      </View>
    );
  }

  return (
    <View>
      <Text className="mb-2 text-sm font-medium text-gray-700">
        {t('settings.macrosGoals.goalSection')}
      </Text>
      <View className="mb-6 flex-row flex-wrap gap-2">
        {ZIEL_OPTIONS.map((option) => {
          const selected = !showIndividuell && ziel === option;
          return (
            <Pressable
              key={option}
              onPress={() => handleZielPress(option)}
              className={`rounded-full px-3 py-2 ${
                selected ? 'bg-[#4F46E5]' : 'bg-white border border-gray-200'
              }`}>
              <Text
                className={`text-sm font-medium ${
                  selected ? 'text-white' : 'text-gray-800'
                }`}>
                {t(`settings.macrosGoals.ziel.${option}`)}
              </Text>
            </Pressable>
          );
        })}
        {showIndividuell ? (
          <View className="rounded-full bg-indigo-50 px-3 py-2">
            <Text className="text-sm font-medium text-indigo-700">
              {t('settings.macrosGoals.ziel.INDIVIDUELL')}
            </Text>
          </View>
        ) : null}
      </View>

      <Text className="mb-3 text-base font-semibold text-gray-900">
        {t('settings.macrosGoals.macrosSection')}
      </Text>

      {renderMacroRow({
        macroKey: 'protein',
        label: t('home.nutrients.protein'),
        draft: proteinDraft,
        setDraft: setProteinDraft,
        recommendedG: recommended.protein.wert,
        herleitung: recommended.protein.herleitung,
      })}
      {renderMacroRow({
        macroKey: 'fat',
        label: t('home.nutrients.fat'),
        draft: fatDraft,
        setDraft: setFatDraft,
        recommendedG: recommended.fett.wert,
        herleitung: recommended.fett.herleitung,
      })}
      {renderMacroRow({
        macroKey: 'carbs',
        label: t('home.nutrients.carbs'),
        draft: carbsDraft,
        setDraft: setCarbsDraft,
        recommendedG: recommended.kohlenhydrate.wert,
        herleitung: recommended.kohlenhydrate.herleitung,
        locked: !carbsUnlocked,
      })}

      {kcalSum != null ? (
        <View className="mb-4">
          <Text className="text-sm text-gray-700">
            {kcalDelta == null || Math.abs(kcalDelta) <= MACRO_KCAL_TOLERANCE
              ? t('settings.macrosGoals.sumMatches', { kcal: kcalSum })
              : kcalDelta > 0
                ? t('settings.macrosGoals.sumOver', { kcal: kcalSum, delta: kcalDelta })
                : t('settings.macrosGoals.sumUnder', {
                    kcal: kcalSum,
                    delta: Math.abs(kcalDelta),
                  })}
          </Text>
          <Text className="mt-1.5 text-sm text-gray-500">{t('koli.goals.planHint')}</Text>
          {macrosWeightEtaInput ? (
            <View className="mt-1.5">
              <WeightGoalEtaMessage input={macrosWeightEtaInput} />
            </View>
          ) : null}
        </View>
      ) : null}

      {softHints.includes('protein_low') ? (
        <Text className="mb-3 text-sm text-amber-700">
          {t('settings.macrosGoals.hintProteinLow')}
        </Text>
      ) : null}
      {softHints.includes('protein_high') ? (
        <Text className="mb-3 text-sm text-amber-700">
          {t('settings.macrosGoals.hintProteinHigh')}
        </Text>
      ) : null}
      {softHints.includes('fat_low') ? (
        <Text className="mb-3 text-sm text-amber-700">{t('settings.macrosGoals.hintFatLow')}</Text>
      ) : null}

      {carbsNegative ? (
        <Text className="mb-3 text-sm text-red-600">
          {t('settings.macrosGoals.blockedCarbsNegative')}
        </Text>
      ) : null}

      <View className="mb-6 flex-row items-center justify-between rounded-xl border border-gray-200 bg-white px-4 py-3">
        <Text className="mr-3 flex-1 text-sm text-gray-800">
          {t('settings.macrosGoals.adaptToTraining')}
        </Text>
        <Switch
          value={adaptToTraining}
          onValueChange={(value) => void handleAdaptToggle(value)}
          trackColor={{ false: '#D1D5DB', true: '#4F46E5' }}
          thumbColor="#FFFFFF"
        />
      </View>

      <View className="mb-2 rounded-xl border border-gray-200 bg-gray-50 px-4 py-4">
        <Text className="mb-3 text-base font-semibold text-gray-900">
          {t('settings.macrosGoals.otherGoalsSection')}
        </Text>
        <Text className="mb-2 text-sm font-medium text-gray-700">
          {t('home.nutrients.fiber')}
        </Text>
        <Text className="mb-2 text-xs" style={{ color: TEXT_SECONDARY }}>
          {t('settings.macrosGoals.fiberMinimumHint')}
        </Text>
        <TextInput
          keyboardType={resolveNumericKeyboardType('number-pad')}
          value={fiberDraft}
          onChangeText={(text) => {
            if (!isPartialNumericInput(text, false)) {
              return;
            }
            setFiberDraft(text);
            setHasManualEdits(true);
          }}
          placeholder="0"
          placeholderTextColor="#9CA3AF"
          className="h-11 w-full self-stretch rounded-xl border border-gray-200 bg-white px-3 text-base text-gray-900"
          {...NUMERIC_DONE_INPUT_PROPS}
        />
        {fiberG != null &&
        isMacroValueDiverged(fiberG, recommended.ballaststoffe.wert) ? (
          <Pressable
            accessibilityRole="button"
            onPress={() => applyRecommended('fiber')}
            className="mt-1.5 self-start">
            <Text className="text-sm text-indigo-600">
              {t('settings.macrosGoals.fiberMinimumReset', {
                value: Math.round(recommended.ballaststoffe.wert),
              })}
            </Text>
          </Pressable>
        ) : (
          <Text className="mt-1.5 text-sm" style={{ color: TEXT_SECONDARY }}>
            {t('settings.macrosGoals.fiberMinimum', {
              value: Math.round(recommended.ballaststoffe.wert),
            })}
          </Text>
        )}
        <Text className="mt-1 text-xs" style={{ color: TEXT_SECONDARY }}>
          {recommended.ballaststoffe.herleitung}
        </Text>
      </View>

      {inlineError ? (
        <Text className="mb-2 text-sm text-red-600">{inlineError}</Text>
      ) : null}

      {!hideActions ? (
        <Pressable
          accessibilityRole="button"
          disabled={!canSave}
          onPress={() => void handleSave()}
          className={`mt-2 h-11 items-center justify-center rounded-xl ${
            canSave ? 'bg-[#4F46E5]' : 'bg-indigo-300'
          }`}>
          {isSaving ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text className="text-base font-semibold text-white">
              {t('settings.common.save')}
            </Text>
          )}
        </Pressable>
      ) : null}
    </View>
  );
}
