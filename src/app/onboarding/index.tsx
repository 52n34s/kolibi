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
import { OnboardingReviewCancelButton } from '@/components/onboarding/onboarding-review-cancel-button';
import { NumberInputAccessory } from '@/components/ui/keyboard-accessory';
import { OnboardingKoliCompanion } from '@/components/onboarding/onboarding-koli-companion';
import { HeightInput } from '@/components/onboarding/height-input';
import { OnboardingLayout } from '@/components/onboarding/onboarding-layout';
import { OptionCard } from '@/components/onboarding/option-card';
import { getGlassCardStyle } from '@/components/ui/glass-styles';
import {
  ActivityOptionIcon,
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
  getMinimumDailyCalories,
  type GoalType,
  isCalorieGoalFarFromTdee,
  skipOnboarding,
} from '@/lib/onboarding';
import { fetchProfileSettings } from '@/lib/profile';
import { useAuthStore } from '@/stores/auth-store';
import { useOnboardingStore } from '@/stores/onboarding-store';

const TOTAL_STEPS = 7;

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
  const initializeUnitSystem = useOnboardingStore((state) => state.initializeUnitSystem);
  const [step, setStep] = useState(0);
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
  const [summaryManuallyEdited, setSummaryManuallyEdited] = useState(false);
  const [isPrefillingReview, setIsPrefillingReview] = useState(isReviewMode);

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

        if (profile.birth_date) {
          setBirthDate(new Date(profile.birth_date));
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
  const minimumDailyCalories = getMinimumDailyCalories(effectiveSex);

  const parsedHeight = Number(heightCm);
  const parsedWeight = Number(weightKg);
  const parsedCustomCalories = Number(customCalorieGoal);
  const parsedDailyCalories = Number(dailyCalorieGoal);

  const maintenanceCalories = useMemo(() => {
    if (!birthDate || !activityLevel || !parsedHeight || !parsedWeight) {
      return null;
    }

    return calculateMaintenanceCalories({
      biologicalSex: effectiveSex,
      birthDate,
      heightCm: parsedHeight,
      weightKg: parsedWeight,
      activityLevel,
    });
  }, [activityLevel, birthDate, effectiveSex, parsedHeight, parsedWeight]);

  const showCustomGoalFarFromTdeeWarning =
    maintenanceCalories !== null &&
    parsedCustomCalories > 0 &&
    isCalorieGoalFarFromTdee(parsedCustomCalories, maintenanceCalories);

  const showSummaryFarFromTdeeWarning =
    maintenanceCalories !== null &&
    parsedDailyCalories > 0 &&
    isCalorieGoalFarFromTdee(parsedDailyCalories, maintenanceCalories) &&
    (summaryManuallyEdited || goalType === 'custom');

  const calorieGoalCalculation = useMemo(() => {
    if (!birthDate || !activityLevel || !goalType || !parsedHeight || !parsedWeight) {
      return null;
    }

    return calculateDailyCalorieGoalDetails({
      biologicalSex: effectiveSex,
      birthDate,
      heightCm: parsedHeight,
      weightKg: parsedWeight,
      activityLevel,
      goalType,
      customCalorieGoal: goalType === 'custom' ? parsedCustomCalories : null,
    });
  }, [
    activityLevel,
    birthDate,
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
    if (step !== 1) {
      setShowDatePicker(false);
    }
  }, [step]);

  useEffect(() => {
    if (step !== 6 || summaryManuallyEdited || !birthDate || !activityLevel || !goalType) {
      return;
    }

    setDailyCalorieGoal(
      String(
        calculateDailyCalorieGoal({
          biologicalSex: effectiveSex,
          birthDate,
          heightCm: parsedHeight,
          weightKg: parsedWeight,
          activityLevel,
          goalType,
          customCalorieGoal: goalType === 'custom' ? parsedCustomCalories : null,
        }),
      ),
    );
  }, [
    activityLevel,
    birthDate,
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
      case 2:
        if (!heightCm.trim()) {
          return t('onboarding.errors.heightRequired');
        }
        if (!parsedHeight || parsedHeight < 100 || parsedHeight > 250) {
          return t('onboarding.errors.heightInvalid');
        }
        return null;
      case 3:
        if (!weightKg.trim()) {
          return t('onboarding.errors.weightRequired');
        }
        if (!parsedWeight || parsedWeight < 30 || parsedWeight > 300) {
          return t('onboarding.errors.weightInvalid');
        }
        return null;
      case 4:
        if (!activityLevel) {
          return t('onboarding.errors.activityRequired');
        }
        return null;
      case 5:
        if (!goalType) {
          return t('onboarding.errors.goalRequired');
        }
        if (goalType === 'custom') {
          if (!customCalorieGoal.trim()) {
            return t('onboarding.errors.customCaloriesRequired');
          }
          if (
            !parsedCustomCalories ||
            parsedCustomCalories < minimumDailyCalories ||
            parsedCustomCalories > 6000
          ) {
            return t('onboarding.errors.customCaloriesInvalid', { min: minimumDailyCalories });
          }
        }
        return null;
      case 6:
        if (
          !parsedDailyCalories ||
          parsedDailyCalories < minimumDailyCalories ||
          parsedDailyCalories > 6000
        ) {
          return t('onboarding.errors.summaryCaloriesInvalid', { min: minimumDailyCalories });
        }
        return null;
      default:
        return null;
    }
  }

  function handleNext() {
    const validationError = validateCurrentStep();
    if (validationError) {
      setErrorMessage(validationError);
      return;
    }

    setErrorMessage(null);
    setStep((current) => Math.min(current + 1, TOTAL_STEPS - 1));
  }

  function handleBack() {
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
    const userId = session?.user?.id;
    if (!userId) {
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      if (skipped) {
        await skipOnboarding(userId);
      } else {
        if (!birthDate || !activityLevel || !goalType) {
          throw new Error(t('onboarding.errors.saveFailed'));
        }

        const calorieGoalSource =
          goalType === 'custom' || summaryManuallyEdited ? 'custom' : 'calculated';

        await completeOnboarding(userId, {
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

      await useAuthStore.getState().refreshOnboardingStatus();

      if (isReviewMode) {
        router.back();
        return;
      }

      router.replace('/home' as Href);
    } catch (error) {
      console.error('[Onboarding] save failed:', error);

      if (error && typeof error === 'object') {
        const supabaseError = error as {
          code?: string;
          message?: string;
          details?: string;
          hint?: string;
        };

        console.error('[Onboarding] save failed details:', {
          code: supabaseError.code,
          message: supabaseError.message,
          details: supabaseError.details,
          hint: supabaseError.hint,
        });
      }

      setErrorMessage(t('onboarding.errors.saveFailed'));
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleSkip() {
    void finishOnboarding(true);
  }

  function handleFinish() {
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
      case 1:
        return (
          <View>
            <StepHeader
              step={1}
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
      case 2:
        return (
          <View>
            <StepHeader
              step={2}
              title={t('onboarding.height.title')}
              subtitle={t('onboarding.height.subtitle')}
            />
            <HeightInput heightCm={heightCm} onChangeHeightCm={setHeightCm} />
          </View>
        );
      case 3:
        return (
          <View>
            <StepHeader
              step={3}
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
      case 4:
        return (
          <View>
            <StepHeader
              step={4}
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
      case 5:
        return (
          <View>
            <StepHeader
              step={5}
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
      case 6:
        return (
          <View>
            <StepHeader
              step={6}
              title={t('onboarding.summary.title')}
              subtitle={t('onboarding.summary.subtitle')}
            />
            <Text className="mb-4 text-lg font-semibold text-[#4F46E5]">
              {t('onboarding.summary.dailyGoal', { calories: parsedDailyCalories || 0 })}
            </Text>
            {maintenanceCalories !== null && (
              <Text className="mb-4 text-sm text-gray-500">
                {t('onboarding.summary.tdee', { calories: maintenanceCalories })}
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

  console.log('[SKIP DEBUG]', {
    step,
    totalSteps: TOTAL_STEPS,
    isReviewMode,
    hideSkip: isReviewMode,
  });

  return (
    <OnboardingLayout>
      <View className="flex-1">
        <View className="px-6 pt-2">
          {isReviewMode ? (
            <View className="mb-2">
              <OnboardingReviewCancelButton
                label={t('settings.common.cancel')}
                accessibilityLabel={t('settings.common.cancel')}
              />
            </View>
          ) : null}
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
              paddingBottom: ONBOARDING_FOOTER_ESTIMATED_HEIGHT + 16,
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
          <OnboardingFooter
            step={step}
            totalSteps={TOTAL_STEPS}
            isSubmitting={isSubmitting}
            errorMessage={errorMessage}
            backLabel={t('onboarding.back')}
            skipLabel={t('onboarding.skip')}
            nextLabel={t('onboarding.next')}
            finishLabel={isReviewMode ? t('settings.onboardingReview.save') : t('onboarding.finish')}
            hideSkip={isReviewMode}
            onBack={handleBack}
            onSkip={handleSkip}
            onNext={handleNext}
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
