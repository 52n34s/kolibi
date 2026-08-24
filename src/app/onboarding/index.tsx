import { Href, router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  View,
} from 'react-native';

import {
  BirthDatePickerModal,
  openBirthDatePickerAndroid,
} from '@/components/onboarding/birth-date-picker';
import { OnboardingField, OnboardingFieldPressable } from '@/components/onboarding/onboarding-field';
import { OnboardingFooter, ONBOARDING_FOOTER_ESTIMATED_HEIGHT } from '@/components/onboarding/onboarding-footer';
import {
  OnboardingLegalNotice,
  ONBOARDING_LEGAL_NOTICE_HEIGHT,
} from '@/components/onboarding/onboarding-legal-notice';
import { OnboardingReviewCancelButton } from '@/components/onboarding/onboarding-review-cancel-button';
import { NumberInputAccessory } from '@/components/ui/keyboard-accessory';
import { OnboardingKoliCompanion } from '@/components/onboarding/onboarding-koli-companion';
import { HeightInput } from '@/components/onboarding/height-input';
import { OnboardingLayout } from '@/components/onboarding/onboarding-layout';
import { OptionCard } from '@/components/onboarding/option-card';
import { getGlassCardStyle } from '@/components/ui/glass-styles';
import { parseDateOnly } from '@/lib/day-window';
import {
  ActivityOptionIcon,
  DietOptionIcon,
  GoalOptionIcon,
  SexOptionIcon,
} from '@/components/onboarding/step-icons';
import {
  type ActivityLevel,
  type BiologicalSex,
  calculateAge,
  calculateDailyCalorieGoal,
  calculateDailyCalorieGoalDetails,
  calculateMaintenanceCalories,
  completeOnboarding,
  formatAppDate,
  HARD_MINIMUM_DAILY_CALORIES,
  type GoalType,
  isCalorieGoalFarFromTdee,
  isValidDailyCalorieGoalInput,
  MAXIMUM_DAILY_CALORIES,
  resolveActivityLevelForCalorieGoal,
  skipOnboarding,
} from '@/lib/onboarding';
import { fetchProfileSettings } from '@/lib/profile';
import {
  DIET_PREFERENCE_OPTIONS,
  type DietPreferenceValue,
} from '@/components/settings/food-context-controls';
import { useHealthConnectedPreference } from '@/hooks/use-health-connected-preference';
import { useAuthStore } from '@/stores/auth-store';
import { useOnboardingStore } from '@/stores/onboarding-store';
import { formatKcal } from '@/utils/format';

const TOTAL_STEPS = 8;

const DIET_OPTIONS = DIET_PREFERENCE_OPTIONS.filter((option) => option.id !== 'none');

const ACTIVITY_LEVELS: ActivityLevel[] = [
  'mostly_sitting',
  'lightly_active',
  'active',
  'very_active',
];

const GOAL_TYPES: GoalType[] = [
  'maintain',
  'lose_weight',
  'gain_weight',
  'faster_weight_loss',
  'custom',
];

function getGoalHint(goal: GoalType, t: (key: string) => string): string {
  return t(`onboarding.goal.${goal}Hint`);
}

const SEX_OPTIONS: BiologicalSex[] = ['male', 'female', 'prefer_not_to_say'];

function resolveReviewMode(mode: string | string[] | undefined): boolean {
  const value = Array.isArray(mode) ? mode[0] : mode;
  return value === 'review';
}

function StepHeader({ step, title, subtitle }: { step: number; title: string; subtitle: string }) {
  return (
    <View className="mb-6">
      <OnboardingKoliCompanion step={step} />
      <Text className="mb-2 text-2xl font-bold text-gray-900">{title}</Text>
      <Text className="text-base text-gray-500">{subtitle}</Text>
    </View>
  );
}

export default function OnboardingScreen() {
  const { t, i18n } = useTranslation();
  const { mode, previewStep: previewStepParam } = useLocalSearchParams<{
    mode?: string | string[];
    previewStep?: string | string[];
  }>();
  const isReviewMode = resolveReviewMode(mode);
  const session = useAuthStore((state) => state.session);
  const authInitialized = useAuthStore((state) => state.initialized);
  const userId = session?.user?.id;
  const isSessionReady = authInitialized && Boolean(userId);
  const { data: healthConnectedPreference = false } = useHealthConnectedPreference(userId);
  const initializeUnitSystem = useOnboardingStore((state) => state.initializeUnitSystem);
  const [step, setStep] = useState(0);
  const [dietPreference, setDietPreference] = useState<DietPreferenceValue>(null);
  const [biologicalSex, setBiologicalSex] = useState<BiologicalSex | null>(null);
  const [birthDate, setBirthDate] = useState<Date | null>(null);
  const [heightCm, setHeightCm] = useState('');
  const [weightKg, setWeightKg] = useState('');
  const [activityLevel, setActivityLevel] = useState<ActivityLevel | null>(null);
  const [goalType, setGoalType] = useState<GoalType | null>(null);
  const [customCalorieGoal, setCustomCalorieGoal] = useState('');
  const [dailyCalorieGoal, setDailyCalorieGoal] = useState('');
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isFooterDisabled = isSubmitting || !isSessionReady;
  const [summaryManuallyEdited, setSummaryManuallyEdited] = useState(false);
  const [isPrefillingReview, setIsPrefillingReview] = useState(isReviewMode);

  useEffect(() => {
    console.log('[onboarding] footer gate', {
      step,
      isSubmitting,
      authInitialized,
      hasUserId: Boolean(userId),
      isSessionReady,
      isFooterDisabled,
      biologicalSex,
    });
  }, [
    step,
    isSubmitting,
    authInitialized,
    userId,
    isSessionReady,
    isFooterDisabled,
    biologicalSex,
  ]);

  useEffect(() => {
    if (!isReviewMode || !session?.user?.id) {
      return;
    }

    let cancelled = false;

    async function prefillFromProfile() {
      try {
        const profile = await fetchProfileSettings(session!.user!.id);

        if (cancelled) {
          return;
        }

        if (profile.biological_sex) {
          setBiologicalSex(profile.biological_sex);
        }

        setDietPreference(
          DIET_PREFERENCE_OPTIONS.find((option) => option.value === profile.diet_preference)
            ?.value ?? null,
        );

        if (profile.birth_date) {
          setBirthDate(parseDateOnly(profile.birth_date));
        }

        if (profile.height_cm != null) {
          setHeightCm(String(profile.height_cm));
        }

        if (profile.latest_weight_kg != null) {
          setWeightKg(String(profile.latest_weight_kg));
        }

        if (profile.activity_level) {
          setActivityLevel(profile.activity_level);
        }

        if (profile.goal_type) {
          setGoalType(profile.goal_type);
        }

        if (profile.calorie_goal_source === 'custom') {
          setSummaryManuallyEdited(true);
        }

        if (profile.daily_calorie_goal != null) {
          const calories = String(profile.daily_calorie_goal);
          setDailyCalorieGoal(calories);

          if (profile.goal_type === 'custom') {
            setCustomCalorieGoal(calories);
          }
        }
      } catch (prefillError) {
        console.error('[Onboarding] review prefill failed:', prefillError);
      } finally {
        if (!cancelled) {
          setIsPrefillingReview(false);
        }
      }
    }

    void prefillFromProfile();

    return () => {
      cancelled = true;
    };
  }, [isReviewMode, session?.user?.id]);

  const maxBirthDate = useMemo(() => {
    const date = new Date();
    date.setFullYear(date.getFullYear() - 13);
    return date;
  }, []);

  const minBirthDate = useMemo(() => {
    const date = new Date();
    date.setFullYear(date.getFullYear() - 100);
    return date;
  }, []);

  const defaultBirthDate = useMemo(() => {
    const date = new Date();
    date.setFullYear(date.getFullYear() - 25);
    return date;
  }, []);

  const effectiveSex: BiologicalSex = biologicalSex ?? 'prefer_not_to_say';

  const parsedHeight = Number(heightCm);
  const parsedWeight = Number(weightKg);
  const parsedCustomCalories = Number(customCalorieGoal);
  const parsedDailyCalories = Number(dailyCalorieGoal);

  const effectiveActivityLevelForCalories = useMemo(() => {
    if (!activityLevel) {
      return null;
    }

    return resolveActivityLevelForCalorieGoal(activityLevel, healthConnectedPreference === true);
  }, [activityLevel, healthConnectedPreference]);

  const maintenanceCalories = useMemo(() => {
    if (!birthDate || !effectiveActivityLevelForCalories || !parsedHeight || !parsedWeight) {
      return null;
    }

    return calculateMaintenanceCalories({
      biologicalSex: effectiveSex,
      birthDate,
      heightCm: parsedHeight,
      weightKg: parsedWeight,
      activityLevel: effectiveActivityLevelForCalories,
    });
  }, [birthDate, effectiveActivityLevelForCalories, effectiveSex, parsedHeight, parsedWeight]);

  const showCustomGoalFarFromTdeeWarning = isCalorieGoalFarFromTdee(
    parsedCustomCalories,
    maintenanceCalories,
  );

  const showSummaryFarFromTdeeWarning =
    isCalorieGoalFarFromTdee(parsedDailyCalories, maintenanceCalories) &&
    (summaryManuallyEdited || goalType === 'custom');

  const calorieGoalCalculation = useMemo(() => {
    if (!birthDate || !effectiveActivityLevelForCalories || !goalType || !parsedHeight || !parsedWeight) {
      return null;
    }

    return calculateDailyCalorieGoalDetails({
      biologicalSex: effectiveSex,
      birthDate,
      heightCm: parsedHeight,
      weightKg: parsedWeight,
      activityLevel: effectiveActivityLevelForCalories,
      goalType,
      customCalorieGoal: goalType === 'custom' ? parsedCustomCalories : null,
    });
  }, [
    birthDate,
    effectiveActivityLevelForCalories,
    effectiveSex,
    goalType,
    parsedCustomCalories,
    parsedHeight,
    parsedWeight,
  ]);

  useEffect(() => {
    if (!__DEV__) {
      return;
    }

    const raw = Array.isArray(previewStepParam) ? previewStepParam[0] : previewStepParam;
    const parsed = raw != null ? Number(raw) : Number.NaN;

    if (Number.isInteger(parsed) && parsed >= 0 && parsed < TOTAL_STEPS) {
      setStep(parsed);
    }
  }, [previewStepParam]);

  useEffect(() => {
    initializeUnitSystem();
  }, [initializeUnitSystem]);

  useEffect(() => {
    if (__DEV__) {
      console.log('[Onboarding] showDatePicker changed:', showDatePicker);
    }
  }, [showDatePicker]);

  useEffect(() => {
    if (step !== 2) {
      setShowDatePicker(false);
    }
  }, [step]);

  useEffect(() => {
    if (step !== 7 || summaryManuallyEdited || !birthDate || !activityLevel || !goalType) {
      return;
    }

    setDailyCalorieGoal(
      String(
        calculateDailyCalorieGoal({
          biologicalSex: effectiveSex,
          birthDate,
          heightCm: parsedHeight,
          weightKg: parsedWeight,
          activityLevel: effectiveActivityLevelForCalories,
          goalType,
          customCalorieGoal: goalType === 'custom' ? parsedCustomCalories : null,
        }),
      ),
    );
  }, [
    birthDate,
    effectiveActivityLevelForCalories,
    effectiveSex,
    goalType,
    parsedCustomCalories,
    parsedHeight,
    parsedWeight,
    step,
    summaryManuallyEdited,
  ]);

  function validateCurrentStep(): string | null {
    switch (step) {
      case 0:
        return null;
      case 1:
        return null;
      case 2:
        if (!birthDate) {
          return t('onboarding.errors.birthDateRequired');
        }
        {
          const age = calculateAge(birthDate);
          if (age < 13 || age > 100) {
            return t('onboarding.errors.birthDateInvalid');
          }
        }
        return null;
      case 3:
        if (!heightCm.trim()) {
          return t('onboarding.errors.heightRequired');
        }
        if (!parsedHeight || parsedHeight < 100 || parsedHeight > 250) {
          return t('onboarding.errors.heightInvalid');
        }
        return null;
      case 4:
        if (!weightKg.trim()) {
          return t('onboarding.errors.weightRequired');
        }
        if (!parsedWeight || parsedWeight < 30 || parsedWeight > 300) {
          return t('onboarding.errors.weightInvalid');
        }
        return null;
      case 5:
        if (!activityLevel) {
          return t('onboarding.errors.activityRequired');
        }
        return null;
      case 6:
        if (!goalType) {
          return t('onboarding.errors.goalRequired');
        }
        if (goalType === 'custom') {
          if (!customCalorieGoal.trim()) {
            return t('onboarding.errors.customCaloriesRequired');
          }
          if (!isValidDailyCalorieGoalInput(parsedCustomCalories)) {
            return t('onboarding.errors.customCaloriesInvalid', {
              min: HARD_MINIMUM_DAILY_CALORIES,
              max: MAXIMUM_DAILY_CALORIES,
            });
          }
        }
        return null;
      case 7:
        if (!isValidDailyCalorieGoalInput(parsedDailyCalories)) {
          return t('onboarding.errors.summaryCaloriesInvalid', {
            min: HARD_MINIMUM_DAILY_CALORIES,
            max: MAXIMUM_DAILY_CALORIES,
          });
        }
        return null;
      default:
        return null;
    }
  }

  function handleNext() {
    console.log('[onboarding] Weiter onPress', {
      fires: true,
      step,
      biologicalSex,
      isFooterDisabled,
      isSessionReady,
      isSubmitting,
    });

    const validationError = validateCurrentStep();
    console.log('[onboarding] Weiter validation', { step, validationError });
    if (validationError) {
      setErrorMessage(validationError);
      return;
    }

    setErrorMessage(null);
    setStep((current) => {
      const next = Math.min(current + 1, TOTAL_STEPS - 1);
      console.log('[onboarding] Weiter setStep', { from: current, to: next });
      return next;
    });
  }

  function handleBack() {
    console.log('[onboarding] Zurück onPress', { step, isFooterDisabled });
    setErrorMessage(null);
    setStep((current) => Math.max(current - 1, 0));
  }

  function openDatePicker() {
    if (__DEV__) {
      console.log('[Onboarding] openDatePicker tapped, platform:', Platform.OS);
    }

    if (Platform.OS === 'android') {
      openBirthDatePickerAndroid({
        value: birthDate ?? defaultBirthDate,
        minimumDate: minBirthDate,
        maximumDate: maxBirthDate,
        onChange: setBirthDate,
      });
      return;
    }

    if (__DEV__) {
      console.log('[Onboarding] setting showDatePicker=true');
    }

    setShowDatePicker(true);
  }

  function handleBirthDateChange(date: Date) {
    setBirthDate(date);
  }

  async function finishOnboarding(skipped: boolean) {
    console.log('[onboarding] finishOnboarding enter', {
      skipped,
      step,
      biologicalSex,
      isFooterDisabled,
      isSessionReady,
    });

    const currentUserId = useAuthStore.getState().session?.user?.id;
    if (!currentUserId) {
      console.error('[onboarding] finishOnboarding aborted: session not ready', {
        skipped,
        initialized: useAuthStore.getState().initialized,
        session: useAuthStore.getState().session,
      });
      setErrorMessage(t('onboarding.errors.sessionNotReady'));
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      if (skipped) {
        console.log('[onboarding] finishOnboarding calling skipOnboarding', {
          currentUserId,
        });
        await skipOnboarding(currentUserId, dietPreference);
      } else {
        if (!birthDate || !activityLevel || !goalType) {
          console.log('[onboarding] finishOnboarding missing required fields', {
            birthDate,
            activityLevel,
            goalType,
          });
          throw new Error(t('onboarding.errors.saveFailed'));
        }

        const calorieGoalSource =
          goalType === 'custom' || summaryManuallyEdited ? 'custom' : 'calculated';

        console.log('[onboarding] finishOnboarding calling completeOnboarding', {
          currentUserId,
          dietPreference,
          biologicalSex: effectiveSex,
          birthDate,
          heightCm: parsedHeight,
          weightKg: parsedWeight,
          activityLevel,
          goalType,
          calorieGoalSource,
          dailyCalorieGoal: parsedDailyCalories,
        });

        await completeOnboarding(currentUserId, {
          dietPreference,
          biologicalSex: effectiveSex,
          birthDate,
          heightCm: parsedHeight,
          weightKg: parsedWeight,
          activityLevel,
          goalType,
          calorieGoalSource,
          dailyCalorieGoal: parsedDailyCalories,
        });
      }

      console.log('[onboarding] finishOnboarding refreshOnboardingStatus start');
      await useAuthStore.getState().refreshOnboardingStatus();
      console.log('[onboarding] finishOnboarding refreshOnboardingStatus done', {
        isReviewMode,
      });

      if (isReviewMode) {
        router.back();
        return;
      }

      router.replace('/home' as Href);
    } catch (error) {
      console.log('[onboarding] finishOnboarding catch full error', error);
      console.error('[Onboarding] save failed:', error);

      if (error && typeof error === 'object') {
        const supabaseError = error as {
          code?: string;
          message?: string;
          details?: string;
          hint?: string;
        };

        console.log('[onboarding] finishOnboarding catch details', {
          code: supabaseError.code,
          message: supabaseError.message,
          details: supabaseError.details,
          hint: supabaseError.hint,
          keys: Object.keys(error as object),
          stringified: JSON.stringify(error),
        });
      }

      setErrorMessage(t('onboarding.errors.saveFailed'));
    } finally {
      setIsSubmitting(false);
      console.log('[onboarding] finishOnboarding finally', { skipped });
    }
  }

  function handleSkip() {
    console.log('[onboarding] Überspringen onPress', {
      fires: true,
      step,
      biologicalSex,
      isFooterDisabled,
      isSessionReady,
      isSubmitting,
    });
    void finishOnboarding(true);
  }

  /** Cancel = same persistence as Skip: set onboarded_at, then leave the flow. */
  function handleCancel() {
    console.log('[onboarding] Cancel onPress', {
      fires: true,
      step,
      isReviewMode,
      isFooterDisabled,
      isSessionReady,
      isSubmitting,
    });
    void finishOnboarding(true);
  }

  function handleFinish() {
    console.log('[onboarding] Finish onPress', {
      fires: true,
      step,
      biologicalSex,
      isFooterDisabled,
    });
    const validationError = validateCurrentStep();
    if (validationError) {
      setErrorMessage(validationError);
      return;
    }

    void finishOnboarding(false);
  }

  function renderStepContent() {
    switch (step) {
      case 0:
        return (
          <View>
            <StepHeader
              step={0}
              title={t('onboarding.diet.title')}
              subtitle={t('onboarding.diet.subtitle')}
            />
            <View className="gap-3">
              {DIET_OPTIONS.map((option) => {
                const value = option.value as Exclude<DietPreferenceValue, null>;

                return (
                  <OptionCard
                    key={option.id}
                    icon={
                      <DietOptionIcon option={value} selected={dietPreference === value} />
                    }
                    label={t(`settings.profile.foodContext.diet.${option.id}`)}
                    layout="row"
                    selected={dietPreference === value}
                    onPress={() => setDietPreference(value)}
                  />
                );
              })}
            </View>
          </View>
        );
      case 1:
        return (
          <View>
            <StepHeader
              step={1}
              title={t('onboarding.sex.title')}
              subtitle={t('onboarding.sex.subtitle')}
            />
            <View className="gap-3">
              {SEX_OPTIONS.map((option) => (
                <OptionCard
                  key={option}
                  icon={<SexOptionIcon option={option} selected={biologicalSex === option} />}
                  label={t(
                    `onboarding.sex.${option === 'prefer_not_to_say' ? 'preferNotToSay' : option}`,
                  )}
                  layout="row"
                  selected={biologicalSex === option}
                  onPress={() => setBiologicalSex(option)}
                />
              ))}
            </View>
          </View>
        );
      case 2:
        return (
          <View>
            <StepHeader
              step={2}
              title={t('onboarding.birthDate.title')}
              subtitle={t('onboarding.birthDate.subtitle')}
            />
            <OnboardingFieldPressable onPress={openDatePicker}>
              <Text className="text-base text-gray-900">
                {birthDate
                  ? formatAppDate(birthDate, i18n.language)
                  : t('onboarding.birthDate.selectDate')}
              </Text>
            </OnboardingFieldPressable>
          </View>
        );
      case 3:
        return (
          <View>
            <StepHeader
              step={3}
              title={t('onboarding.height.title')}
              subtitle={t('onboarding.height.subtitle')}
            />
            <HeightInput heightCm={heightCm} onChangeHeightCm={setHeightCm} />
          </View>
        );
      case 4:
        return (
          <View>
            <StepHeader
              step={4}
              title={t('onboarding.weight.title')}
              subtitle={t('onboarding.weight.subtitle')}
            />
            <OnboardingField
              keyboardType="numeric"
              placeholder={t('onboarding.weight.placeholder')}
              value={weightKg}
              onChangeText={setWeightKg}
            />
          </View>
        );
      case 5:
        return (
          <View>
            <StepHeader
              step={5}
              title={t('onboarding.activity.title')}
              subtitle={t('onboarding.activity.subtitle')}
            />
            <View className="flex-row flex-wrap gap-3">
              {ACTIVITY_LEVELS.map((level) => (
                <View key={level} className="w-[48%] self-stretch">
                  <OptionCard
                    icon={
                      <ActivityOptionIcon level={level} selected={activityLevel === level} />
                    }
                    label={t(`onboarding.activity.${level}`)}
                    layout="grid"
                    selected={activityLevel === level}
                    onPress={() => setActivityLevel(level)}
                  />
                </View>
              ))}
            </View>
          </View>
        );
      case 6:
        return (
          <View>
            <StepHeader
              step={6}
              title={t('onboarding.goal.title')}
              subtitle={t('onboarding.goal.subtitle')}
            />
            <View className="flex-row flex-wrap gap-3">
              {GOAL_TYPES.map((goal) => (
                <View key={goal} className="w-[48%] self-stretch">
                  <OptionCard
                    hint={getGoalHint(goal, t)}
                    icon={<GoalOptionIcon goal={goal} selected={goalType === goal} />}
                    label={t(`onboarding.goal.${goal}`)}
                    layout="grid"
                    selected={goalType === goal}
                    onPress={() => setGoalType(goal)}
                  />
                </View>
              ))}
            </View>
            {goalType === 'faster_weight_loss' && (
              <Text className="mb-3 text-sm text-amber-700">
                {t('onboarding.goal.faster_weight_lossWarning')}
              </Text>
            )}
            {goalType === 'custom' && (
              <>
                <OnboardingField
                  keyboardType="numeric"
                  placeholder={t('onboarding.goal.customPlaceholder')}
                  value={customCalorieGoal}
                  onChangeText={setCustomCalorieGoal}
                />
                {showCustomGoalFarFromTdeeWarning && (
                  <Text className="mt-2 text-sm text-amber-700">
                    {t('onboarding.summary.farFromTdeeWarning')}
                  </Text>
                )}
              </>
            )}
          </View>
        );
      case 7:
        return (
          <View>
            <StepHeader
              step={7}
              title={t('onboarding.summary.title')}
              subtitle={t('onboarding.summary.subtitle')}
            />
            <Text className="mb-4 text-lg font-semibold text-[#4F46E5]">
              {t('onboarding.summary.dailyGoal', {
                calories: formatKcal(parsedDailyCalories || 0),
              })}
            </Text>
            {maintenanceCalories !== null && (
              <Text className="mb-4 text-sm text-gray-500">
                {t('onboarding.summary.tdee', { calories: formatKcal(maintenanceCalories) })}
              </Text>
            )}
            {calorieGoalCalculation?.clampedToMinimum && !summaryManuallyEdited && (
              <Text className="mb-4 text-sm text-amber-700">
                {t('onboarding.summary.minimumApplied', {
                  calculated: calorieGoalCalculation.rawCalories,
                  minimum: calorieGoalCalculation.minimumCalories,
                })}
              </Text>
            )}
            <Text className="mb-2 text-sm font-medium text-gray-700">
              {t('onboarding.summary.caloriesLabel')}
            </Text>
            <OnboardingField
              keyboardType="numeric"
              value={dailyCalorieGoal}
              onChangeText={(value) => {
                setSummaryManuallyEdited(true);
                setDailyCalorieGoal(value);
              }}
            />
            {showSummaryFarFromTdeeWarning && (
              <Text className="mt-2 text-sm text-amber-700">
                {t('onboarding.summary.farFromTdeeWarning')}
              </Text>
            )}
          </View>
        );
      default:
        return null;
    }
  }

  const progress = ((step + 1) / TOTAL_STEPS) * 100;

  return (
    <OnboardingLayout>
      <View className="flex-1">
        <View className="px-6 pt-2">
          <View className="mb-2">
            <OnboardingReviewCancelButton
              label={t('settings.common.cancel')}
              accessibilityLabel={t('settings.common.cancel')}
              disabled={isFooterDisabled}
              onPress={handleCancel}
            />
          </View>
          <Text className="mb-4 text-sm text-gray-500">
            {t('onboarding.stepOf', { current: step + 1, total: TOTAL_STEPS })}
          </Text>
          <View
            className="overflow-hidden rounded-full"
            style={getGlassCardStyle({
              height: 8,
              borderRadius: 9999,
              backgroundColor: 'rgba(255, 255, 255, 0.34)',
              borderColor: 'rgba(255, 255, 255, 0.78)',
              borderWidth: 1,
              shadowOpacity: 0,
              elevation: 0,
            })}>
            <View
              className="h-full rounded-full bg-[#4F46E5]"
              style={{ width: `${progress}%` }}
            />
          </View>
        </View>

        <KeyboardAvoidingView
          className="flex-1"
          style={{ backgroundColor: 'transparent' }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 8 : 0}>
          <ScrollView
            className="flex-1 px-6"
            style={{ backgroundColor: 'transparent' }}
            contentContainerStyle={{
              flexGrow: 1,
              paddingTop: 12,
              paddingBottom:
                ONBOARDING_FOOTER_ESTIMATED_HEIGHT +
                (step === 0 && !isReviewMode ? ONBOARDING_LEGAL_NOTICE_HEIGHT : 0) +
                16,
            }}
            keyboardShouldPersistTaps="always">
            <View className="justify-center py-4" style={{ minHeight: 320 }}>
              {renderStepContent()}
            </View>
          </ScrollView>
        </KeyboardAvoidingView>

        {/* IMPORTANT: Skip button must always remain visible in non-review onboarding mode. Do not remove during redesigns. */}
        <View
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'transparent',
          }}>
          {/* IMPORTANT: Legal notice must remain on step 0 only (first onboarding step, non-review). Do not remove during redesigns. Do not show on steps 1–7 or in review mode. */}
          {step === 0 && !isReviewMode ? <OnboardingLegalNotice /> : null}
          <OnboardingFooter
            step={step}
            totalSteps={TOTAL_STEPS}
            isSubmitting={isSubmitting}
            actionsDisabled={isFooterDisabled}
            errorMessage={errorMessage}
            backLabel={t('onboarding.back')}
            skipLabel={t('onboarding.skip')}
            nextLabel={t('onboarding.next')}
            finishLabel={isReviewMode ? t('settings.onboardingReview.save') : t('onboarding.finish')}
            hideSkip={isReviewMode}
            onBack={handleBack}
            onSkip={() => {
              console.log('[onboarding] Footer onSkip wrapper', {
                step,
                isFooterDisabled,
                biologicalSex,
              });
              handleSkip();
            }}
            onNext={() => {
              console.log('[onboarding] Footer onNext wrapper', {
                step,
                isFooterDisabled,
                biologicalSex,
              });
              handleNext();
            }}
            onFinish={handleFinish}
          />
        </View>
      </View>

      <BirthDatePickerModal
          visible={showDatePicker}
          value={birthDate ?? defaultBirthDate}
          minimumDate={minBirthDate}
          maximumDate={maxBirthDate}
          onChange={handleBirthDateChange}
          onClose={() => setShowDatePicker(false)}
      />
      <NumberInputAccessory />
    </OnboardingLayout>
  );
}
