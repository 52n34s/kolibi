import { useQueryClient } from '@tanstack/react-query';
import * as Sentry from '@sentry/react-native';
import { Href, router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
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
import { ONBOARDING_ACCENT } from '@/components/onboarding/onboarding-styles';
import { useOpenPlanWizard } from '@/components/training/PlanWizardEntryCard';
import { NumberInputAccessory } from '@/components/ui/keyboard-accessory';
import { OnboardingKoliCompanion } from '@/components/onboarding/onboarding-koli-companion';
import { HeightInput } from '@/components/onboarding/height-input';
import { WeightInput } from '@/components/onboarding/weight-input';
import { OnboardingLayout } from '@/components/onboarding/onboarding-layout';
import { OptionCard } from '@/components/onboarding/option-card';
import { getGlassCardStyle } from '@/components/ui/glass-styles';
import { WeightGoalEtaMessage } from '@/components/weight-goal-eta-message';
import { parseDateOnly } from '@/lib/day-window';
import { suggestInitialTargetWeightKg } from '@/lib/macro-goals';
import {
  resolveGoalDirectionFromCalories,
  type WeightGoalEtaInput,
} from '@/lib/weight-goal-eta';
import {
  ActivityOptionIcon,
  GoalOptionIcon,
  PurposeOptionIcon,
} from '@/components/onboarding/step-icons';
import {
  DEFAULT_GOAL_TYPE_BY_CATEGORY,
  goalCategoryForGoalType,
  goalTypeForCategory,
  isLegacyGoalType,
  visibleGoalCategories,
  type GoalCategory,
} from '@/lib/goal-category';
import { setPlanWizardPending } from '@/lib/onboarding-local-state';
import {
  displayedGoalType,
  fetchUsagePurpose,
  recordWrittenGoalType,
  resolveWritableGoalType,
  saveUsagePurpose,
} from '@/lib/onboarding-profile-extras';
import {
  buildOnboardingSteps,
  resolveOnboardingPreviewStep,
  type OnboardingStepId,
} from '@/lib/onboarding-steps';
import { PLAN_WIZARD_AVAILABLE, resolvePostOnboardingWizard } from '@/lib/plan-wizard';
import { USAGE_PURPOSES, type UsagePurpose } from '@/lib/usage-purpose';
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
  CalorieSource,
  resolveCalorieSource,
  resolveEffectiveDailyCalorieGoal,
  resolveReviewCaloriePrefill,
  shouldRecalculateOnboardingDailyGoal,
  skipOnboarding,
  summaryManuallyEditedAfterGoalTypeChange,
} from '@/lib/onboarding';
import { fetchProfileSettings } from '@/lib/profile';
import { parseWeightInputToKg } from '@/lib/weight-parse';
import { useHealthConnectedPreference } from '@/hooks/use-health-connected-preference';
import { useRecentActiveEnergy } from '@/hooks/use-recent-active-energy';
import { useAuthStore } from '@/stores/auth-store';
import { useOnboardingStore } from '@/stores/onboarding-store';
import { formatKcal } from '@/utils/format';

const ACTIVITY_LEVELS: ActivityLevel[] = [
  'mostly_sitting',
  'lightly_active',
  'active',
  'very_active',
];

const SEX_OPTIONS: BiologicalSex[] = ['male', 'female', 'prefer_not_to_say'];

function resolveReviewMode(mode: string | string[] | undefined): boolean {
  const value = Array.isArray(mode) ? mode[0] : mode;
  return value === 'review';
}

function StepHeader({
  stepId,
  title,
  subtitle,
}: {
  stepId: OnboardingStepId;
  title: string;
  subtitle: string;
}) {
  return (
    <View className="mb-6">
      <OnboardingKoliCompanion stepId={stepId} />
      <Text className="mb-2 text-2xl font-bold text-gray-900">{title}</Text>
      <Text className="text-base text-gray-500">{subtitle}</Text>
    </View>
  );
}

export default function OnboardingScreen() {
  const queryClient = useQueryClient();
  const { t, i18n } = useTranslation();
  const {
    mode,
    previewStep: previewStepParam,
    startAt: startAtParam,
  } = useLocalSearchParams<{
    mode?: string | string[];
    previewStep?: string | string[];
    /** Review mode only: step id to open first (e.g. 'goal' from the goals area). */
    startAt?: string | string[];
  }>();
  const isReviewMode = resolveReviewMode(mode);
  const session = useAuthStore((state) => state.session);
  const authInitialized = useAuthStore((state) => state.initialized);
  const userId = session?.user?.id;
  const isSessionReady = authInitialized && Boolean(userId);
  const { data: healthConnectedPreference = false } = useHealthConnectedPreference(userId);
  const { data: recentActiveEnergy } = useRecentActiveEnergy(
    userId,
    healthConnectedPreference === true,
  );
  const initializeUnitSystem = useOnboardingStore((state) => state.initializeUnitSystem);
  const unitSystem = useOnboardingStore((state) => state.unitSystem);
  const steps = useMemo(() => buildOnboardingSteps({ isReviewMode }), [isReviewMode]);
  const [step, setStep] = useState(0);
  const currentStep = steps[Math.min(step, steps.length - 1)]!;
  const openPlanWizard = useOpenPlanWizard();
  const [usagePurpose, setUsagePurpose] = useState<UsagePurpose | null>(null);
  /** Goal stored before this run — kept when its category is picked again (gain_weight, custom, …). */
  const [initialGoalType, setInitialGoalType] = useState<GoalType | null>(null);
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

        const purpose = await fetchUsagePurpose(session!.user!.id);
        if (cancelled) {
          return;
        }
        setUsagePurpose(purpose);

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

        const shownGoalType = displayedGoalType(session!.user!.id, profile.goal_type);
        if (shownGoalType) {
          setGoalType(shownGoalType);
          setInitialGoalType(shownGoalType);
        }

        const caloriePrefill = resolveReviewCaloriePrefill({
          calorie_goal_source: profile.calorie_goal_source,
          daily_calorie_goal: profile.daily_calorie_goal,
          goal_type: profile.goal_type,
        });
        setSummaryManuallyEdited(caloriePrefill.summaryManuallyEdited);
        if (caloriePrefill.dailyCalorieGoal != null) {
          setDailyCalorieGoal(caloriePrefill.dailyCalorieGoal);
        }
        if (caloriePrefill.customCalorieGoal != null) {
          setCustomCalorieGoal(caloriePrefill.customCalorieGoal);
        }
      } catch {
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
  // WeightInput always stores kilograms (like HeightInput stores cm).
  const parsedWeight = parseWeightInputToKg({ value: weightKg, unitSystem: 'metric' });
  const parsedCustomCalories = Number(customCalorieGoal);
  const parsedDailyCalories = Number(dailyCalorieGoal);

  const calorieSource = useMemo(
    () => resolveCalorieSource(healthConnectedPreference === true),
    [healthConnectedPreference],
  );

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
      calorieSource,
    });
  }, [activityLevel, birthDate, calorieSource, effectiveSex, parsedHeight, parsedWeight]);

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
      calorieSource,
      goalType,
      customCalorieGoal: goalType === 'custom' ? parsedCustomCalories : null,
      recentActiveEnergy,
    });
  }, [
    activityLevel,
    birthDate,
    calorieSource,
    effectiveSex,
    goalType,
    parsedCustomCalories,
    parsedHeight,
    parsedWeight,
    recentActiveEnergy,
  ]);

  /**
   * What an average day shows once movement joins — the number the home screen
   * renders. The stored field stays the base, so comparisons against expected
   * maintenance have to lift it here first.
   */
  const resolveExpectedDayGoal = (baseDailyGoal: number): number | null => {
    if (calorieGoalCalculation == null || !(baseDailyGoal > 0)) {
      return null;
    }
    return resolveEffectiveDailyCalorieGoal({
      calorieSource,
      baseDailyGoal,
      activeEnergyBurnedKcal: calorieGoalCalculation.expectedActiveEnergyKcal,
      bmr: calorieGoalCalculation.bmr,
    });
  };

  const summaryExpectedDayGoal = resolveExpectedDayGoal(parsedDailyCalories);
  const customExpectedDayGoal = resolveExpectedDayGoal(parsedCustomCalories);

  const showCustomGoalFarFromTdeeWarning = isCalorieGoalFarFromTdee(
    customExpectedDayGoal ?? parsedCustomCalories,
    calorieGoalCalculation?.expectedMaintenanceKcal ?? maintenanceCalories,
  );

  const showSummaryFarFromTdeeWarning =
    isCalorieGoalFarFromTdee(
      summaryExpectedDayGoal ?? parsedDailyCalories,
      calorieGoalCalculation?.expectedMaintenanceKcal ?? maintenanceCalories,
    ) &&
    (summaryManuallyEdited || goalType === 'custom');

  const isCalculatedGoal = !summaryManuallyEdited && goalType !== 'custom';
  const reportedFloorBreachRef = useRef<string | null>(null);

  useEffect(() => {
    if (calorieGoalCalculation == null || !isCalculatedGoal) {
      return;
    }
    if (!calorieGoalCalculation.clampedToMinimum) {
      return;
    }

    const signature = [
      goalType,
      calorieSource,
      calorieGoalCalculation.bmr,
      calorieGoalCalculation.rawCalories,
    ].join(':');
    if (reportedFloorBreachRef.current === signature) {
      return;
    }
    reportedFloorBreachRef.current = signature;

    Sentry.captureException(
      new Error('Calculated onboarding calorie goal fell below the resting-metabolism floor'),
      {
        tags: { calorie_goal: 'floor_breach', calorie_source: calorieSource },
        extra: {
          goalType,
          bmr: calorieGoalCalculation.bmr,
          maintenanceCalories: calorieGoalCalculation.maintenanceCalories,
          expectedMaintenanceKcal: calorieGoalCalculation.expectedMaintenanceKcal,
          expectedActiveEnergyKcal: calorieGoalCalculation.expectedActiveEnergyKcal,
          rawCalories: calorieGoalCalculation.rawCalories,
          dailyCalories: calorieGoalCalculation.dailyCalories,
          effectiveDailyCalories: calorieGoalCalculation.effectiveDailyCalories,
          floor: calorieGoalCalculation.minimumCalories,
        },
      },
    );
  }, [calorieGoalCalculation, calorieSource, goalType, isCalculatedGoal]);

  const onboardingWeightEtaInput = useMemo((): WeightGoalEtaInput | null => {
    if (!goalType || !parsedHeight || !parsedWeight || !maintenanceCalories) {
      return null;
    }
    const dailyFromCalc = calorieGoalCalculation?.dailyCalories ?? null;
    const daily =
      summaryManuallyEdited || goalType === 'custom'
        ? parsedDailyCalories > 0
          ? parsedDailyCalories
          : goalType === 'custom' && parsedCustomCalories > 0
            ? parsedCustomCalories
            : dailyFromCalc
        : dailyFromCalc ?? (parsedDailyCalories > 0 ? parsedDailyCalories : null);

    if (daily == null || !(daily > 0)) {
      return null;
    }

    const direction = resolveGoalDirectionFromCalories({
      goalType,
      dailyCalorieGoal: daily,
      maintenanceCalories,
    });
    if (direction === 'none') {
      return null;
    }

    let targetWeightKg = suggestInitialTargetWeightKg({
      weightKg: parsedWeight,
      heightCm: parsedHeight,
      goalType,
    });
    // Custom goals keep weight unchanged in suggestInitialTargetWeightKg — seed a
    // modest target so a calorie deficit/surplus still yields an ETA.
    if (goalType === 'custom' && Math.abs(targetWeightKg - parsedWeight) < 0.05) {
      targetWeightKg = suggestInitialTargetWeightKg({
        weightKg: parsedWeight,
        heightCm: parsedHeight,
        goalType: direction === 'loss' ? 'lose_weight' : 'gain_weight',
      });
    }
    return {
      logs: [],
      targetWeightKg,
      currentWeightKg: parsedWeight,
      dailyCalorieGoal: daily,
      maintenanceCalories,
      goalDirection: direction,
    };
  }, [
    calorieGoalCalculation?.dailyCalories,
    goalType,
    maintenanceCalories,
    parsedCustomCalories,
    parsedDailyCalories,
    parsedHeight,
    parsedWeight,
    summaryManuallyEdited,
  ]);

  useEffect(() => {
    if (!__DEV__) {
      return;
    }

    const raw = Array.isArray(previewStepParam) ? previewStepParam[0] : previewStepParam;
    const index = resolveOnboardingPreviewStep(raw, steps);

    if (index != null) {
      setStep(index);
    }
  }, [previewStepParam, steps]);

  useEffect(() => {
    if (!isReviewMode) {
      return;
    }
    const raw = Array.isArray(startAtParam) ? startAtParam[0] : startAtParam;
    const index = resolveOnboardingPreviewStep(raw, steps);
    if (index != null) {
      setStep(index);
    }
  }, [isReviewMode, startAtParam, steps]);

  useEffect(() => {
    initializeUnitSystem();
  }, [initializeUnitSystem]);

  useEffect(() => {
    if (currentStep.id !== 'about') {
      setShowDatePicker(false);
    }
  }, [currentStep.id]);

  useEffect(() => {
    // Recalculate whenever inputs change — not only while the summary is visible —
    // so a goal change updates the summary before the user opens it.
    // Skip when the user typed a custom target on the summary (or chose goal type custom).
    if (
      !shouldRecalculateOnboardingDailyGoal({
        summaryManuallyEdited,
        goalType,
      }) ||
      !birthDate ||
      !activityLevel ||
      !parsedHeight ||
      !parsedWeight
    ) {
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
          calorieSource,
          goalType: goalType!,
          customCalorieGoal: null,
          recentActiveEnergy,
        }).dailyCalorieGoal,
      ),
    );
  }, [
    activityLevel,
    birthDate,
    calorieSource,
    effectiveSex,
    goalType,
    parsedHeight,
    parsedWeight,
    recentActiveEnergy,
    summaryManuallyEdited,
  ]);

  function validateCurrentStep(): string | null {
    switch (currentStep.id) {
      case 'purpose':
        return null;
      case 'about':
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
      case 'height':
        if (!heightCm.trim()) {
          return t('onboarding.errors.heightRequired');
        }
        if (!parsedHeight || parsedHeight < 100 || parsedHeight > 250) {
          return t('onboarding.errors.heightInvalid');
        }
        return null;
      case 'weight':
        if (!weightKg.trim()) {
          return t('onboarding.errors.weightRequired');
        }
        if (!parsedWeight || parsedWeight < 30 || parsedWeight > 300) {
          return t('onboarding.errors.weightInvalid');
        }
        return null;
      case 'activity':
        if (!activityLevel) {
          return t('onboarding.errors.activityRequired');
        }
        return null;
      case 'goal':
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
      case 'summary':
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
    const validationError = validateCurrentStep();
    if (validationError) {
      setErrorMessage(validationError);
      return;
    }

    setErrorMessage(null);
    setStep((current) => Math.min(current + 1, steps.length - 1));
  }

  function handleBack() {
    setErrorMessage(null);
    setStep((current) => Math.max(current - 1, 0));
  }

  function openDatePicker() {
    if (Platform.OS === 'android') {
      openBirthDatePickerAndroid({
        value: birthDate ?? defaultBirthDate,
        minimumDate: minBirthDate,
        maximumDate: maxBirthDate,
        onChange: setBirthDate,
      });
      return;
    }

    setShowDatePicker(true);
  }

  function handleBirthDateChange(date: Date) {
    setBirthDate(date);
  }

  async function finishOnboarding(skipped: boolean) {
    const currentUserId = useAuthStore.getState().session?.user?.id;
    if (!currentUserId) {
      setErrorMessage(t('onboarding.errors.sessionNotReady'));
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      if (skipped) {
        await skipOnboarding(currentUserId);
      } else {
        if (!birthDate || !activityLevel || !goalType || parsedWeight == null) {
          throw new Error(t('onboarding.errors.saveFailed'));
        }

        const calorieGoalSource =
          goalType === 'custom' || summaryManuallyEdited ? 'custom' : 'calculated';
        // 'strength' is written as build_muscle until its enum migration ran.
        const writtenGoalType = await resolveWritableGoalType(goalType);

        await completeOnboarding(currentUserId, {
          biologicalSex: effectiveSex,
          birthDate,
          heightCm: parsedHeight,
          weightKg: parsedWeight,
          activityLevel,
          goalType: writtenGoalType,
          calorieGoalSource,
          dailyCalorieGoal: parsedDailyCalories,
          tdee: maintenanceCalories,
        });
        recordWrittenGoalType(currentUserId, { chosen: goalType, written: writtenGoalType });
      }

      if (usagePurpose) {
        await saveUsagePurpose(currentUserId, usagePurpose);
      }

      await useAuthStore.getState().refreshOnboardingStatus();
      // Goal, weight and targets changed: every screen reading them loads again
      // (Today kept the old kcal and layout until the next app start).
      void queryClient.invalidateQueries();
      if (isReviewMode) {
        router.back();
        return;
      }

      const wizardAction = resolvePostOnboardingWizard({
        purpose: usagePurpose,
        wizardAvailable: PLAN_WIZARD_AVAILABLE,
        isReviewMode,
      });
      setPlanWizardPending(currentUserId, wizardAction === 'pending_training_tab');

      router.replace('/home' as Href);
      if (wizardAction === 'open_now') {
        // Wizard sits on top of home, so closing or skipping it lands there.
        openPlanWizard();
      }
    } catch {
      setErrorMessage(t('onboarding.errors.saveFailed'));
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleSkip() {
    void finishOnboarding(true);
  }

  /** Cancel = same persistence as Skip: set onboarded_at, then leave the flow. */
  function handleCancel() {
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

  function selectGoalCategory(category: GoalCategory) {
    const nextGoal = goalTypeForCategory(category, initialGoalType);
    if (nextGoal === goalType) {
      return;
    }

    setGoalType(nextGoal);
    // A goal-type change invalidates a typed/custom summary target.
    const nextFlag = summaryManuallyEditedAfterGoalTypeChange(nextGoal);
    if (nextFlag !== null) {
      setSummaryManuallyEdited(nextFlag);
    }
  }

  function renderStepContent() {
    switch (currentStep.id) {
      case 'purpose':
        return (
          <View>
            <StepHeader
              stepId="purpose"
              title={t('onboarding2.purpose.title')}
              subtitle={t('onboarding2.purpose.subtitle')}
            />
            <View className="gap-3">
              {USAGE_PURPOSES.map((purpose) => (
                <OptionCard
                  key={purpose}
                  icon={
                    <PurposeOptionIcon purpose={purpose} selected={usagePurpose === purpose} />
                  }
                  label={t(`onboarding2.purpose.${purpose}`)}
                  hint={t(`onboarding2.purpose.${purpose}Hint`)}
                  layout="row"
                  selected={usagePurpose === purpose}
                  onPress={() => setUsagePurpose(purpose)}
                />
              ))}
            </View>
          </View>
        );
      case 'about':
        return (
          <View>
            <StepHeader
              stepId="about"
              title={t('onboarding2.about.title')}
              subtitle={t('onboarding2.about.subtitle')}
            />
            <OnboardingFieldPressable onPress={openDatePicker}>
              <Text className="text-base text-gray-900">
                {birthDate
                  ? formatAppDate(birthDate, i18n.language)
                  : t('onboarding.birthDate.selectDate')}
              </Text>
            </OnboardingFieldPressable>
            <Text className="mb-2 mt-6 text-sm font-medium text-gray-700">
              {t('onboarding2.about.sexLabel')}
            </Text>
            <View className="flex-row flex-wrap gap-2">
              {SEX_OPTIONS.map((option) => {
                const selected = biologicalSex === option;
                return (
                  <Pressable
                    key={option}
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                    className="rounded-full px-4 py-2"
                    style={{
                      borderWidth: 1,
                      borderColor: selected ? ONBOARDING_ACCENT : 'rgba(255, 255, 255, 0.78)',
                      backgroundColor: selected ? ONBOARDING_ACCENT : 'rgba(255, 255, 255, 0.5)',
                    }}
                    onPress={() => setBiologicalSex(option)}>
                    <Text
                      className="text-sm font-medium"
                      style={{ color: selected ? '#FFFFFF' : '#111827' }}>
                      {t(
                        `onboarding.sex.${option === 'prefer_not_to_say' ? 'preferNotToSay' : option}`,
                      )}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        );
      case 'height':
        return (
          <View>
            <StepHeader
              stepId="height"
              title={t('onboarding.height.title')}
              subtitle={t('onboarding.height.subtitle')}
            />
            <HeightInput heightCm={heightCm} onChangeHeightCm={setHeightCm} />
          </View>
        );
      case 'weight':
        return (
          <View>
            <StepHeader
              stepId="weight"
              title={t('onboarding.weight.title')}
              subtitle={
                unitSystem === 'imperial'
                  ? t('onboarding.weight.subtitleImperial')
                  : t('onboarding.weight.subtitleMetric')
              }
            />
            <WeightInput weightKg={weightKg} onChangeWeightKg={setWeightKg} />
          </View>
        );
      case 'activity':
        return (
          <View>
            <StepHeader
              stepId="activity"
              title={t('onboarding.activity.title')}
              subtitle={t('onboarding.activity.subtitle')}
            />
            <Text className="mb-4 text-sm text-gray-600">
              {t('onboarding.activity.sportExcludeHint')}
            </Text>
            <View className="flex-row flex-wrap gap-3">
              {ACTIVITY_LEVELS.map((level) => (
                <View key={level} className="w-[48%] self-stretch">
                  <OptionCard
                    icon={
                      <ActivityOptionIcon level={level} selected={activityLevel === level} />
                    }
                    label={t(`onboarding.activity.${level}`)}
                    hint={t(`onboarding.activity.${level}Hint`)}
                    layout="grid"
                    selected={activityLevel === level}
                    onPress={() => setActivityLevel(level)}
                  />
                </View>
              ))}
            </View>
          </View>
        );
      case 'goal': {
        const selectedCategory = goalCategoryForGoalType(goalType);
        return (
          <View>
            <StepHeader
              stepId="goal"
              title={t('onboarding2.goal.title')}
              subtitle={t('onboarding2.goal.subtitle')}
            />
            <View className="flex-row flex-wrap gap-3">
              {visibleGoalCategories(initialGoalType).map((category) => (
                <View key={category} className="w-[48%] self-stretch">
                  <OptionCard
                    hint={t(`onboarding2.goal.${category}Hint`)}
                    icon={
                      <GoalOptionIcon
                        goal={DEFAULT_GOAL_TYPE_BY_CATEGORY[category]}
                        selected={selectedCategory === category}
                      />
                    }
                    label={t(`onboarding2.goal.${category}`)}
                    layout="grid"
                    selected={selectedCategory === category}
                    onPress={() => selectGoalCategory(category)}
                  />
                </View>
              ))}
            </View>
            {goalType != null && goalType !== 'custom' && isLegacyGoalType(goalType) ? (
              <Text className="mt-3 text-sm text-gray-600">
                {t('onboarding2.goal.legacyKept', { name: t(`onboarding.goal.${goalType}`) })}
              </Text>
            ) : null}
            {goalType === 'faster_weight_loss' && (
              <Text className="mb-3 mt-2 text-sm text-amber-700">
                {t('onboarding.goal.faster_weight_lossWarning')}
              </Text>
            )}
            {onboardingWeightEtaInput && goalType !== 'custom' ? (
              <View className="mt-2 mb-1">
                <WeightGoalEtaMessage input={onboardingWeightEtaInput} />
              </View>
            ) : null}
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
                {onboardingWeightEtaInput ? (
                  <View className="mt-3">
                    <WeightGoalEtaMessage input={onboardingWeightEtaInput} />
                  </View>
                ) : null}
              </>
            )}
          </View>
        );
      }
      case 'summary':
        return (
          <View>
            <StepHeader
              stepId="summary"
              title={t('onboarding.summary.title')}
              subtitle={t('onboarding.summary.subtitle')}
            />
            <Text className="mb-4 text-lg font-semibold text-[#4F46E5]">
              {t('onboarding.summary.dailyGoal', {
                calories: formatKcal(
                  summaryExpectedDayGoal ?? (parsedDailyCalories || 0),
                ),
              })}
            </Text>
            {maintenanceCalories !== null && (
              <Text className="mb-4 text-sm text-gray-500">
                {calorieSource === CalorieSource.HEALTH && calorieGoalCalculation != null
                  ? t('onboarding.summary.tdeeHealth', {
                      calories: formatKcal(calorieGoalCalculation.expectedMaintenanceKcal),
                    })
                  : t('onboarding.summary.tdee', {
                      calories: formatKcal(maintenanceCalories),
                    })}
              </Text>
            )}
            {onboardingWeightEtaInput ? (
              <View className="mb-4">
                <WeightGoalEtaMessage input={onboardingWeightEtaInput} />
              </View>
            ) : null}
            {calorieGoalCalculation?.clampedToMinimum && !summaryManuallyEdited && (
              <Text className="mb-4 text-sm text-amber-700">
                {t('onboarding.summary.minimumApplied', {
                  calculated: calorieGoalCalculation.rawCalories,
                  minimum: calorieGoalCalculation.minimumCalories,
                })}
              </Text>
            )}
            <Text className="mb-2 text-sm font-medium text-gray-700">
              {calorieSource === CalorieSource.HEALTH
                ? t('onboarding.summary.caloriesLabelHealth')
                : t('onboarding.summary.caloriesLabel')}
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

  const progress = ((step + 1) / steps.length) * 100;

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
            {t('onboarding.stepOf', { current: step + 1, total: steps.length })}
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
                (currentStep.showsLegalNotice ? ONBOARDING_LEGAL_NOTICE_HEIGHT : 0) +
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
          {/* IMPORTANT: Legal notice must remain on the first onboarding step only (non-review), see buildOnboardingSteps. Do not remove during redesigns. Do not show on later steps or in review mode. */}
          {currentStep.showsLegalNotice ? <OnboardingLegalNotice /> : null}
          <OnboardingFooter
            step={step}
            totalSteps={steps.length}
            isSubmitting={isSubmitting}
            actionsDisabled={isFooterDisabled}
            errorMessage={errorMessage}
            backLabel={t('onboarding.back')}
            skipLabel={t('onboarding.skip')}
            nextLabel={t('onboarding.next')}
            finishLabel={isReviewMode ? t('settings.onboardingReview.save') : t('onboarding.finish')}
            hideSkip={!currentStep.skippable}
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
