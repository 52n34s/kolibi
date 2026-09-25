import { Ionicons } from '@expo/vector-icons';
import * as Sentry from '@sentry/react-native';
import { Href, router } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { runOnJS } from 'react-native-reanimated';
import { useQuery, useQueryClient } from '@tanstack/react-query';

import { HomeLayout, useMeshScreenInsets } from '@/components/home/home-layout';
import { BarcodeScanButton } from '@/components/home/BarcodeScanButton';
import { HistoryKoliButton } from '@/components/home/history-koli-button';
import { ManualEntryButton } from '@/components/home/ManualEntryButton';
import { ScanMealButton } from '@/components/home/ScanMealButton';
import {
  SCAN_BUTTON_BAR_GAP,
  SCAN_BUTTON_LABEL_GAP,
  SCAN_BUTTON_LABEL_LINE_HEIGHT,
  scanButtonBarScrollPadding,
} from '@/components/home/scan-button-bar';
import { BarcodeFlowModal, type BarcodeFlowState } from '@/components/scan/BarcodeFlowModal';
import { ProductLookupModal, type ProductLookupState } from '@/components/scan/ProductLookupModal';
import {
  createRowItemId,
  rowItemsToEditable,
  type MealItemRowItem,
} from '@/components/scan/meal-item-row-model';
import { ManualMealEntrySheet } from '@/components/scan/ManualMealEntrySheet';
import { MealEditSheet } from '@/components/scan/MealEditSheet';
import {
  MealConfirmationSheet,
  type MealLabelContext,
} from '@/components/scan/MealConfirmationSheet';
import { MultiPhotoCameraFlow } from '@/components/scan/MultiPhotoCameraFlow';
import { ScanApiErrorSheet } from '@/components/scan/ScanApiErrorSheet';
import { ScanOptionsSheet } from '@/components/scan/ScanOptionsSheet';
import { ScanParseErrorSheet } from '@/components/scan/ScanParseErrorSheet';
import { ScanRateLimitSheet } from '@/components/scan/ScanRateLimitSheet';
import {
  getOnboardingIdleCardStyle,
  ONBOARDING_ACCENT,
  ONBOARDING_CARD_RADIUS,
} from '@/components/onboarding/onboarding-styles';
import { getGlassPillStyle } from '@/components/ui/glass-styles';
import { DayMealList } from '@/components/day/DayMealList';
import { DaySummaryBlock } from '@/components/day/DaySummaryBlock';
import { HistoryPanel } from '@/components/history/history-panel';
import { HomeActiveSessionBar } from '@/components/home/HomeActiveSessionBar';
import { HomeProgressRows, type HomeProgressRowItem } from '@/components/home/home-progress-rows';
import { HomeSupplementChips } from '@/components/home/HomeSupplementChips';
import { PillSegmentSwitcher } from '@/components/koli/pill-segment-switcher';
import { TrainingPanel } from '@/components/training/TrainingPanel';
import {
  WeightProgressCard,
  weightGoalProgressPercent,
} from '@/components/home/weight-progress-card';
import { WeightInputSheet } from '@/components/home/weight-update-sheet';
import { BuildUpCard } from '@/components/measurements/build-up-card';
import { MeasurementsSheet } from '@/components/measurements/measurements-sheet';
import { PaywallSheet } from '@/components/paywall/PaywallSheet';
import { useGatePremiumAccess } from '@/hooks/use-gate-premium-access';
import { useHomeDashboard } from '@/hooks/use-home-dashboard';
import { useTrialStatus } from '@/hooks/use-premium-access';
import { useHealthConnectedPreference } from '@/hooks/use-health-connected-preference';
import { useBodyMeasurementsAvailable } from '@/hooks/use-build-up';
import { useProfileSettings } from '@/hooks/use-profile-settings';
import { isBuildUpGoal } from '@/lib/build-up';
import { useTrainingSessionsWeek } from '@/hooks/use-training-sessions-week';
import { useMovementGoalActual } from '@/hooks/use-movement-goal-actual';
import { useWorkoutSessionsRange } from '@/hooks/use-workout-sessions-range';
import { useFeatureFlag } from '@/hooks/use-feature-flag';
import { localDateKey, parseDateOnly } from '@/lib/day-window';
import { resolveDisplayWeight } from '@/lib/display-weight';
import {
  getTimeOfDay,
  resolveDisplayName,
} from '@/lib/home';
import { localWeekDateKeys } from '@/lib/training-sessions';
import {
  buildWeekDayMarkers,
  countDistinctTrainingDaysMerged,
} from '@/lib/workouts/week-day-markers';
import { resolveTrainingTabEnabled } from '@/lib/workouts/training-release';
import { cmToInches, kgToLbs } from '@/lib/units';
import { distanceKmToDisplay, useUnitSystem } from '@/lib/measure-units';
import {
  fetchWeightKgForDay,
  formatWeightForDisplay,
  parseWeightInputToKg,
  upsertWeightLog,
} from '@/lib/weight-logs';
import {
  fetchWaistCmForDay,
  parseWaistInputToCm,
  upsertWaistLog,
} from '@/lib/waist-logs';
import {
  fetchBodyFatPctForDay,
  parseBodyFatInputToPct,
  upsertBodyFatLog,
} from '@/lib/body-fat-logs';
import { saveWaistCircumferenceToHealth } from '@/lib/health';
import {
  saveScannedMeal,
  deleteMeal,
  updateMealWithItems,
  type TodayMeal,
} from '@/lib/meals';
import { ensurePushRegistration, PUSH_PERMISSION_ASKED_KEY } from '@/lib/notifications';
import {
  checkScanAllowance,
  incrementScanCount,
  scanAllowanceQueryKey,
} from '@/lib/scanGate';
import { trackAnonymousLimitReached, trackAnonymousScanCompleted } from '@/lib/analytics';
import { navigateToSignIn } from '@/lib/auth';
import { consumePaywallAfterSignup } from '@/lib/pending-paywall';
import { MEAL_SOURCE, type MealSource } from '@/lib/meal-sources';
import { deleteMealPhotoUris, prepareMealPhotoUri } from '@/lib/meal-photo';
import { pickMealPhotosFromGallery } from '@/lib/pick-meal-gallery';
import { touchUserActivity } from '@/lib/user-activity';
import {
  BarcodeLookupAbortedError,
  BarcodeNutrimentsMissingError,
  BarcodeProductNotFoundError,
  barcodeProductToFoodSearchProduct,
  fetchProductByBarcode,
} from '@/services/barcode/OpenFoodFactsService';
import { applyUserFoodCalibration } from '@/lib/food-calibration';
import { enrichVisionItemsWithResolvedFoods } from '@/lib/resolve-foods';
import { resolveFoodIdForOffProduct } from '@/lib/foods-cache';
import {
  MealVisionApiError,
  MealVisionParseError,
  MealVisionRateLimitError,
  MealVisionService,
} from '@/services/mealVision/MealVisionService';
import {
  labelQuantityPresetSource,
  labelToEditableItem,
  type EditableMealItem,
} from '@/services/mealVision/types';
import { useAuthStore } from '@/stores/auth-store';
import { useWorkoutSessionStore } from '@/stores/workout-session-store';
import { createChunkedSecureStoreAdapter } from '@/lib/chunked-secure-store';

const MAX_WEIGHT_KG = 699.9;
const SIGNUP_ROUTE = '/(auth)/login' as Href;

type HomeTab = 'today' | 'meals' | 'training' | 'history';
type WeightSheetKind = 'current' | null;

function navigateToSignup() {
  router.push(SIGNUP_ROUTE);
}

function HomeLoadingState() {
  return (
    <View className="flex-1 items-center justify-center px-6">
      <ActivityIndicator size="large" color={ONBOARDING_ACCENT} />
    </View>
  );
}

function HomeErrorState() {
  const { t } = useTranslation();

  return (
    <View className="flex-1 items-center justify-center px-6">
      <Text className="text-center text-base text-gray-600">{t('home.errors.loadFailed')}</Text>
    </View>
  );
}

export default function HomeScreen() {
  const { t, i18n } = useTranslation();
  const { contentTopPadding, insets } = useMeshScreenInsets();
  const queryClient = useQueryClient();
  const session = useAuthStore((state) => state.session);
  const userId = session?.user?.id;
  const unitSystem = useUnitSystem();
  const { data, isLoading, isError, error } = useHomeDashboard();
  const { data: healthConnectedPreference = false } = useHealthConnectedPreference(userId);
  const { data: profileSettings } = useProfileSettings(userId);
  // Read-only: muscle gain goals get the build-up card on Today.
  const showBuildUpToday = isBuildUpGoal(profileSettings?.profile?.goal_type);
  const measurementsAvailable = useBodyMeasurementsAvailable(showBuildUpToday);
  const [showMeasurementsSheet, setShowMeasurementsSheet] = useState(false);
  const movementGoalType = data?.profile?.movement_goal_type ?? null;
  const movementGoalValue = data?.profile?.movement_goal_value ?? null;
  const movementGoalPeriod = data?.profile?.movement_goal_period ?? null;
  const hasMovementGoal =
    movementGoalType != null &&
    movementGoalValue != null &&
    movementGoalValue > 0 &&
    movementGoalPeriod != null;
  const trainingSessionsPerWeek = data?.profile?.training_sessions_per_week ?? null;
  const hasTrainingGoal =
    trainingSessionsPerWeek != null &&
    Number.isFinite(trainingSessionsPerWeek) &&
    trainingSessionsPerWeek >= 1;
  const { data: movementActual } = useMovementGoalActual({
    enabled: healthConnectedPreference === true && hasMovementGoal,
    type: movementGoalType,
    period: movementGoalPeriod,
  });
  const { data: trainingSessionsWeek = [] } = useTrainingSessionsWeek(hasTrainingGoal);
  const activeSession = useWorkoutSessionStore((state) => state.active);
  const { data: trainingTabFlag = false } = useFeatureFlag('training_tab');
  const trainingTabEnabled = resolveTrainingTabEnabled(trainingTabFlag);
  const weekKeys = useMemo(() => localWeekDateKeys(), []);
  const { data: workoutSessionsWeek = [] } = useWorkoutSessionsRange({
    startKey: weekKeys[0]!,
    endKey: weekKeys[6]!,
    enabled: hasTrainingGoal || Boolean(activeSession) || trainingTabEnabled,
  });
  const { isInTrial, daysLeft: trialDaysLeft } = useTrialStatus(userId);
  const {
    isAnonymousUser,
    isRegisteredProductLocked,
    isProductAccessLoading,
    gatePremiumAccess,
  } = useGatePremiumAccess();
  const { data: scanAllowance } = useQuery({
    queryKey: userId ? scanAllowanceQueryKey(userId) : ['scan-allowance'],
    enabled: !!userId,
    staleTime: 15 * 1000,
    queryFn: () => {
      if (!userId) {
        throw new Error('Missing user id');
      }

      return checkScanAllowance(userId);
    },
  });

  const [showPaywall, setShowPaywall] = useState(false);
  const [paywallWithValuePitch, setPaywallWithValuePitch] = useState(false);
  const [homeTab, setHomeTab] = useState<HomeTab>(() =>
    useWorkoutSessionStore.getState().active ? 'training' : 'today',
  );
  const [weightSheet, setWeightSheet] = useState<WeightSheetKind>(null);
  const [weightDraft, setWeightDraft] = useState('');
  const [waistDraft, setWaistDraft] = useState('');
  const [bodyFatDraft, setBodyFatDraft] = useState('');
  const [isSavingWeight, setIsSavingWeight] = useState(false);
  const [showScanOptions, setShowScanOptions] = useState(false);
  const [showCameraFlow, setShowCameraFlow] = useState(false);
  const [scanPhotoCount, setScanPhotoCount] = useState(1);
  const [isAnalyzingMeal, setIsAnalyzingMeal] = useState(false);
  const [showMealConfirmation, setShowMealConfirmation] = useState(false);
  /** Scanned photo kept on the device only while the result sheet is open (for "Teilen"). */
  const [resultPhotoUris, setResultPhotoUris] = useState<string[]>([]);
  const [visionItems, setVisionItems] = useState<EditableMealItem[]>([]);
  const [labelContext, setLabelContext] = useState<MealLabelContext | null>(null);
  const [isSavingMeal, setIsSavingMeal] = useState(false);
  const [showRateLimitSheet, setShowRateLimitSheet] = useState(false);
  const [rateLimitResetAt, setRateLimitResetAt] = useState<string | null>(null);
  const [showParseErrorSheet, setShowParseErrorSheet] = useState(false);
  const [showApiErrorSheet, setShowApiErrorSheet] = useState(false);
  const [pendingPhotoUris, setPendingPhotoUris] = useState<string[]>([]);
  const [pendingMealSource, setPendingMealSource] = useState<MealSource>(MEAL_SOURCE.PHOTO_CAMERA);
  const [isPickingGalleryPhotos, setIsPickingGalleryPhotos] = useState(false);
  const [barcodeFlow, setBarcodeFlow] = useState<BarcodeFlowState>({ kind: 'closed' });
  const [productLookupFlow, setProductLookupFlow] = useState<ProductLookupState>({ kind: 'closed' });
  const [pendingBarcode, setPendingBarcode] = useState<string | null>(null);
  const pendingBarcodeRef = useRef<string | null>(null);
  const pendingPaywallRef = useRef(false);
  const paywallDismissTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [isSavingBarcodeMeal, setIsSavingBarcodeMeal] = useState(false);
  const [showBarcodeLookupSlow, setShowBarcodeLookupSlow] = useState(false);
  const weightDraftLoadRef = useRef(0);
  const barcodeLookupAbortRef = useRef<AbortController | null>(null);
  const productLookupAbortRef = useRef<AbortController | null>(null);
  const [showManualEntrySheet, setShowManualEntrySheet] = useState(false);
  const [isSavingManualMeal, setIsSavingManualMeal] = useState(false);
  const [editingMealId, setEditingMealId] = useState<string | null>(null);
  const [isSavingMealEdit, setIsSavingMealEdit] = useState(false);
  const [isDeletingMeal, setIsDeletingMeal] = useState(false);

  const homeTabs = useMemo<HomeTab[]>(() => {
    const tabs: HomeTab[] = ['today', 'meals'];
    if (trainingTabEnabled) {
      tabs.push('training');
    }
    tabs.push('history');
    return tabs;
  }, [trainingTabEnabled]);

  useEffect(() => {
    if (!homeTabs.includes(homeTab)) {
      setHomeTab('today');
    }
  }, [homeTabs, homeTab]);

  const homeTabIndex = homeTabs.indexOf(homeTab);
  // The scan bar belongs to the food flow. On the training tab it covered
  // "Einheit nachtragen" and "Plan bearbeiten", so it stays hidden there.
  // Without a plan the bar stays visible; a tap opens the paywall
  // (requirePremiumAccessToCapture, AGB Ziffer 10 Abs. 5).
  const hideScanButtons =
    isProductAccessLoading ||
    homeTab === 'training' ||
    homeTab === 'history';

  const secureStore = useMemo(() => createChunkedSecureStoreAdapter(), []);

  const ensurePushOnMealSave = useCallback(async () => {
    if (!userId) {
      return;
    }

    try {
      const result = await ensurePushRegistration(userId, { askIfUndetermined: true });

      Sentry.addBreadcrumb({
        category: 'push-debug',
        message: 'ensurePushOnMealSave result',
        level: 'info',
        data: { status: result.status, prompted: result.prompted, userId },
      });

      // Nag date only after the user answered (or OS already denied). Never on token_failed / unavailable.
      if (
        result.status === 'denied' ||
        (result.status === 'granted' && result.prompted)
      ) {
        await secureStore.setItem(PUSH_PERMISSION_ASKED_KEY, new Date().toISOString());
      }
    } catch (error) {
      Sentry.captureException(error, {
        tags: { push_flow: 'ask_on_meal_save' },
        extra: { userId },
      });
    }
  }, [secureStore, userId]);

  const openPaywall = useCallback((options?: { withValuePitch?: boolean }) => {
    setPaywallWithValuePitch(options?.withValuePitch === true);
    setShowPaywall(true);
  }, []);

  const closePaywall = useCallback(() => {
    setShowPaywall(false);
    setPaywallWithValuePitch(false);
  }, []);

  const flushPendingPaywall = useCallback(() => {
    if (!pendingPaywallRef.current) {
      return;
    }

    pendingPaywallRef.current = false;
    openPaywall({ withValuePitch: true });
  }, [openPaywall]);

  const beginPaywallAfterSheetDismiss = useCallback(() => {
    pendingPaywallRef.current = true;

    // Always schedule a fallback: iOS Modal.onDismiss can miss when sheets close
    // programmatically mid-save, which previously caused a silent access denial.
    if (paywallDismissTimerRef.current) {
      clearTimeout(paywallDismissTimerRef.current);
    }

    paywallDismissTimerRef.current = setTimeout(() => {
      paywallDismissTimerRef.current = null;
      flushPendingPaywall();
    }, 350);
  }, [flushPendingPaywall]);

  const handleMealSheetDismissed = useCallback(() => {
    flushPendingPaywall();
  }, [flushPendingPaywall]);

  /** Front gate for signed-in users: block capture UI and show paywall immediately.
   *  Anonymous users are an account problem, not a billing problem — send them to signup. */
  const requirePremiumAccessToCapture = useCallback(async (): Promise<boolean> => {
    if (isAnonymousUser) {
      navigateToSignup();
      return false;
    }

    const hasAccess = await gatePremiumAccess();
    if (hasAccess) {
      return true;
    }

    openPaywall({ withValuePitch: true });
    return false;
  }, [gatePremiumAccess, isAnonymousUser, openPaywall]);

  const switchHomeTab = useCallback(
    (tab: HomeTab) => {
      void (async () => {
        // Viewing a tab never needs a plan; new entries and training do.
        // Training is only a valid home tab while the feature is enabled.
        if (tab === 'training' && !trainingTabEnabled) {
          return;
        }
        setHomeTab(tab);
      })();
    },
    [trainingTabEnabled],
  );

  const homeTabSwipeGesture = useMemo(
    () =>
      Gesture.Pan()
        .activeOffsetX([-24, 24])
        .failOffsetY([-16, 16])
        .onEnd((event) => {
          'worklet';
          const distance = 56;
          const flick = 450;
          const swipeLeft =
            event.translationX < -distance || event.velocityX < -flick;
          const swipeRight =
            event.translationX > distance || event.velocityX > flick;

          if (swipeLeft && homeTabIndex >= 0 && homeTabIndex < homeTabs.length - 1) {
            runOnJS(switchHomeTab)(homeTabs[homeTabIndex + 1]!);
          } else if (swipeRight && homeTabIndex > 0) {
            runOnJS(switchHomeTab)(homeTabs[homeTabIndex - 1]!);
          }
        }),
    [homeTabIndex, homeTabs, switchHomeTab],
  );

  const openPaywallBecauseScanLimit = useCallback(() => {
    trackAnonymousLimitReached();
    openPaywall({ withValuePitch: true });
  }, [openPaywall]);

  useEffect(() => {
    if (isAnonymousUser || !session) {
      return;
    }

    if (consumePaywallAfterSignup()) {
      openPaywall({ withValuePitch: true });
    }
  }, [session, isAnonymousUser, openPaywall]);

  // If entitlement lapses, surface the paywall once; the tabs stay viewable.
  useEffect(() => {
    if (isAnonymousUser) {
      return;
    }
    if (!isRegisteredProductLocked) {
      return;
    }

    openPaywall({ withValuePitch: true });
  }, [isAnonymousUser, isRegisteredProductLocked, openPaywall]);

  useEffect(() => {
    return () => {
      if (paywallDismissTimerRef.current) {
        clearTimeout(paywallDismissTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (isError && error) {
      console.error('[Home] dashboard load failed:', error);
    }
  }, [error, isError]);

  useEffect(() => {
    if (barcodeFlow.kind !== 'loading') {
      setShowBarcodeLookupSlow(false);
      return;
    }

    const slowMessageTimer = setTimeout(() => {
      setShowBarcodeLookupSlow(true);
    }, 5_000);

    return () => clearTimeout(slowMessageTimer);
  }, [barcodeFlow.kind]);

  const displayName = useMemo(
    () =>
      resolveDisplayName({
        fullName: session?.user?.user_metadata?.full_name,
        name: session?.user?.user_metadata?.name,
        email: session?.user?.email,
      }),
    [session?.user?.email, session?.user?.user_metadata],
  );

  const greeting = useMemo(() => {
    const timeOfDay = getTimeOfDay();
    const greetingKey = displayName
      ? `home.greeting.${timeOfDay}`
      : `home.greeting.${timeOfDay}NoName`;

    return displayName
      ? t(greetingKey, { name: displayName })
      : t(greetingKey);
  }, [displayName, t]);

  const activityRows = useMemo((): HomeProgressRowItem[] => {
    const rows: HomeProgressRowItem[] = [];

    if (hasMovementGoal && movementGoalType != null && movementGoalValue != null) {
      const healthConnected = healthConnectedPreference === true;
      const decimals = movementGoalType === 'steps' ? (0 as const) : (1 as const);
      const unit =
        movementGoalType === 'steps'
          ? t('home.movementGoal.unitSteps')
          : unitSystem === 'imperial'
            ? t('home.movementGoal.unitMi')
            : t('home.movementGoal.unitKm');
      const actualRaw = movementActual ?? 0;
      const actual =
        movementGoalType === 'steps'
          ? actualRaw
          : distanceKmToDisplay(actualRaw, unitSystem);
      const goal =
        movementGoalType === 'steps'
          ? movementGoalValue
          : distanceKmToDisplay(movementGoalValue, unitSystem);

      rows.push({
        key: 'movement',
        label:
          movementGoalType === 'steps'
            ? t('home.movementGoal.labelSteps')
            : movementGoalType === 'running_km'
              ? t('home.movementGoal.labelRunningKm')
              : t('home.movementGoal.labelDistanceKm'),
        actual,
        goal,
        decimals,
        valueUnit: unit ? ` ${unit}` : undefined,
        footerHint: healthConnected ? undefined : t('home.movementGoal.healthRequired'),
        onFooterPress: healthConnected
          ? undefined
          : () => {
              router.push({
                pathname: '/koli',
                params: { segment: 'settings', settingsSubSegment: 'profile' },
              } as Href);
            },
      });
    }

    if (hasTrainingGoal && trainingSessionsPerWeek != null) {
      rows.push({
        key: 'training',
        label: t('home.training.label'),
        actual: countDistinctTrainingDaysMerged(trainingSessionsWeek, workoutSessionsWeek),
        goal: trainingSessionsPerWeek,
        decimals: 0 as const,
        dividerAbove: rows.length > 0,
        weekDayDots: buildWeekDayMarkers(trainingSessionsWeek, workoutSessionsWeek),
        onPress: () => {
          if (trainingTabEnabled) {
            switchHomeTab('training');
            return;
          }
          void (async () => {
            if (!isAnonymousUser && !(await gatePremiumAccess())) {
              openPaywall({ withValuePitch: true });
              return;
            }
            router.push('/koli/training-log' as Href);
          })();
        },
      });
    }

    return rows;
  }, [
    trainingSessionsPerWeek,
    trainingSessionsWeek,
    workoutSessionsWeek,
    hasTrainingGoal,
    trainingTabEnabled,
    hasMovementGoal,
    healthConnectedPreference,
    movementActual,
    movementGoalType,
    movementGoalValue,
    unitSystem,
    t,
    switchHomeTab,
    isAnonymousUser,
    gatePremiumAccess,
    openPaywall,
  ]);

  const latestWeightKg = data?.latestWeight?.weight_kg ?? null;
  const hasWeightLogToday = useMemo(() => {
    const loggedAt = data?.latestWeight?.logged_at;
    if (loggedAt == null) {
      return false;
    }

    return localDateKey(new Date(loggedAt)) === localDateKey();
  }, [data?.latestWeight?.logged_at]);
  const targetWeightKg = data?.profile?.target_weight_kg ?? null;
  const displayWeight = useMemo(() => {
    const logs = data?.weightLogs ?? [];
    if (logs.length === 0) {
      return null;
    }
    const firstKey = localDateKey(new Date(logs[0]!.logged_at));
    return resolveDisplayWeight({
      logs,
      startOn: data?.progressStartDate ?? firstKey,
      today: localDateKey(),
    });
  }, [data?.progressStartDate, data?.weightLogs]);
  const startWeightKg = displayWeight?.barStartKg ?? data?.startWeightKg ?? null;
  const currentDisplayKg = displayWeight?.trendKg ?? latestWeightKg;
  const weightUnitLabels = useMemo(
    () => ({
      kgLabel: t('onboarding.units.kg'),
      lbsLabel: t('onboarding.units.lbs'),
    }),
    [t],
  );

  const weightLabel = useMemo(() => {
    if (currentDisplayKg == null) {
      return t('home.weight.notLogged');
    }

    return formatWeightForDisplay({
      weightKg: currentDisplayKg,
      unitSystem,
      ...weightUnitLabels,
    });
  }, [currentDisplayKg, t, unitSystem, weightUnitLabels]);

  const dailyWeightLabel = useMemo(() => {
    const dailyKg = displayWeight?.dailyKg;
    const trendKg = displayWeight?.trendKg;
    if (dailyKg == null || trendKg == null) {
      return null;
    }
    const dailyFormatted = formatWeightForDisplay({
      weightKg: dailyKg,
      unitSystem,
      ...weightUnitLabels,
    });
    const trendFormatted = formatWeightForDisplay({
      weightKg: trendKg,
      unitSystem,
      ...weightUnitLabels,
    });
    if (dailyFormatted === trendFormatted) {
      return null;
    }
    return t('home.weight.dailyToday', { weight: dailyFormatted });
  }, [displayWeight?.dailyKg, displayWeight?.trendKg, t, unitSystem, weightUnitLabels]);

  const weightProgressPercent = useMemo(
    () =>
      weightGoalProgressPercent({
        startKg: startWeightKg,
        currentKg: displayWeight?.barEndKg ?? currentDisplayKg,
        targetKg: targetWeightKg,
      }),
    [currentDisplayKg, displayWeight?.barEndKg, startWeightKg, targetWeightKg],
  );

  const startWeightLabel = useMemo(() => {
    if (startWeightKg == null) {
      return '';
    }

    return formatWeightForDisplay({
      weightKg: startWeightKg,
      unitSystem,
      ...weightUnitLabels,
    });
  }, [startWeightKg, unitSystem, weightUnitLabels]);

  const targetWeightLabel = useMemo(() => {
    if (targetWeightKg == null) {
      return '';
    }

    return formatWeightForDisplay({
      weightKg: targetWeightKg,
      unitSystem,
      ...weightUnitLabels,
    });
  }, [targetWeightKg, unitSystem, weightUnitLabels]);

  function weightKgToDraft(weightKg: number | null): string {
    if (weightKg == null) {
      return '';
    }

    return unitSystem === 'imperial' ? String(kgToLbs(weightKg)) : String(weightKg);
  }

  function waistCmToDraft(waistCm: number | null): string {
    if (waistCm == null) {
      return '';
    }

    return unitSystem === 'imperial' ? String(cmToInches(waistCm)) : String(waistCm);
  }

  function bodyFatPctToDraft(bodyFatPct: number | null): string {
    if (bodyFatPct == null) {
      return '';
    }

    return String(bodyFatPct);
  }

  /** Only the most recent call may write the drafts — a slower earlier
   *  response must not clobber a newer day's prefill or user input. */
  const loadWeightSheetDraftsForDay = useCallback(
    async (loggedOn: string) => {
      const requestId = ++weightDraftLoadRef.current;

      if (!userId) {
        setWeightDraft('');
        setWaistDraft('');
        setBodyFatDraft('');
        return;
      }

      try {
        const [weightKg, waistCm, bodyFatPct] = await Promise.all([
          fetchWeightKgForDay(userId, loggedOn),
          fetchWaistCmForDay(userId, loggedOn),
          fetchBodyFatPctForDay(userId, loggedOn),
        ]);
        if (requestId !== weightDraftLoadRef.current) {
          return;
        }

        setWeightDraft(weightKgToDraft(weightKg));
        setWaistDraft(waistCmToDraft(waistCm));
        setBodyFatDraft(bodyFatPctToDraft(bodyFatPct));
      } catch (loadError) {
        console.error('[Home] weight sheet day load failed:', loadError);
        if (requestId !== weightDraftLoadRef.current) {
          return;
        }

        setWeightDraft('');
        setWaistDraft('');
        setBodyFatDraft('');
      }
    },
    [unitSystem, userId],
  );

  function openCurrentWeightSheet() {
    setWeightDraft('');
    setWaistDraft('');
    setBodyFatDraft('');
    setWeightSheet('current');
    void loadWeightSheetDraftsForDay(localDateKey(new Date()));
  }

  function closeWeightSheet() {
    weightDraftLoadRef.current += 1;
    setWaistDraft('');
    setBodyFatDraft('');
    setWeightDraft('');
    setWeightSheet(null);
  }

  async function saveCurrentWeight(loggedOn: string) {
    if (!userId) {
      return;
    }

    if (!isAnonymousUser && !(await gatePremiumAccess())) {
      openPaywall({ withValuePitch: true });
      return;
    }

    const hasWeightInput = weightDraft.trim().length > 0;
    const hasWaistInput = waistDraft.trim().length > 0;
    const hasBodyFatInput = bodyFatDraft.trim().length > 0;

    if (!hasWeightInput && !hasWaistInput && !hasBodyFatInput) {
      Alert.alert(t('settings.errors.title'), t('home.weight.invalid'));
      return;
    }

    const weightKg = hasWeightInput
      ? parseWeightInputToKg({ value: weightDraft, unitSystem })
      : null;
    if (hasWeightInput && (weightKg == null || !(weightKg > 0) || weightKg >= MAX_WEIGHT_KG)) {
      Alert.alert(t('settings.errors.title'), t('home.weight.invalid'));
      return;
    }

    const waistCm = hasWaistInput
      ? parseWaistInputToCm({ value: waistDraft, unitSystem })
      : null;
    if (hasWaistInput && (waistCm == null || !(waistCm > 0))) {
      Alert.alert(
        t('settings.errors.title'),
        t(
          unitSystem === 'imperial'
            ? 'home.weight.waistInvalidIn'
            : 'home.weight.waistInvalid',
        ),
      );
      return;
    }

    const bodyFatPct = hasBodyFatInput ? parseBodyFatInputToPct(bodyFatDraft) : null;
    if (hasBodyFatInput && (bodyFatPct == null || !(bodyFatPct > 0))) {
      Alert.alert(t('settings.errors.title'), t('home.weight.bodyFatInvalid'));
      return;
    }

    setIsSavingWeight(true);

    try {
      if (weightKg != null) {
        await upsertWeightLog({
          userId,
          weightKg,
          loggedOn,
          source: 'manual',
        });
      }
      if (waistCm != null) {
        await upsertWaistLog({ userId, waistCm, loggedOn });
        if (healthConnectedPreference) {
          try {
            const measuredAt = parseDateOnly(loggedOn);
            measuredAt.setHours(12, 0, 0, 0);
            await saveWaistCircumferenceToHealth(waistCm, measuredAt);
          } catch (healthError) {
            console.error('[Home] waist HealthKit save failed:', healthError);
          }
        }
      }
      if (bodyFatPct != null) {
        await upsertBodyFatLog({
          userId,
          bodyFatPct,
          loggedOn,
          source: 'manual',
        });
      }
      await queryClient.invalidateQueries({ queryKey: ['home-dashboard', userId] });
      await queryClient.invalidateQueries({ queryKey: ['macro-goal-editor', userId] });
      await queryClient.invalidateQueries({ queryKey: ['profile-settings', userId] });
      await queryClient.invalidateQueries({ queryKey: ['history', userId] });
      await queryClient.invalidateQueries({ queryKey: ['latest-body-fat', userId] });
      closeWeightSheet();
    } catch (saveError) {
      console.error('[Home] weight save failed:', saveError);
      Alert.alert(t('settings.errors.title'), t('home.weight.saveFailed'));
    } finally {
      setIsSavingWeight(false);
    }
  }

  function handleTodayMealPress(meal: TodayMeal) {
    setEditingMealId(meal.id);
  }

  async function handleScanPress() {
    if (!userId) {
      return;
    }

    const allowance = await checkScanAllowance(userId);
    if (allowance.isAnonymous) {
      if (!allowance.allowed) {
        openPaywallBecauseScanLimit();
        return;
      }

      setShowScanOptions(true);
      return;
    }

    if (!(await requirePremiumAccessToCapture())) {
      return;
    }

    setShowScanOptions(true);
  }

  function handleScanCapture(photoCount: number) {
    setScanPhotoCount(photoCount);
    setPendingMealSource(MEAL_SOURCE.PHOTO_CAMERA);
    setShowCameraFlow(true);
  }

  async function handleGalleryPick(photoCount: number) {
    if (isPickingGalleryPhotos || isAnalyzingMeal) {
      return;
    }

    setIsPickingGalleryPhotos(true);

    try {
      const result = await pickMealPhotosFromGallery({
        selectionLimit: photoCount,
        permissionDeniedTitle: t('home.scan.gallery.permissionTitle'),
        permissionDeniedMessage: t('home.scan.gallery.permissionBody'),
        openSettingsLabel: t('home.scan.gallery.openSettings'),
        openSettingsFailedTitle: t('home.scan.gallery.openSettingsFailedTitle'),
        openSettingsFailedMessage: t('home.scan.gallery.openSettingsFailedMessage'),
        cancelLabel: t('settings.common.cancel'),
        okLabel: t('settings.common.ok'),
        onPhotosSelected: () => {
          // Before prepareMealPhotoUri — covers resize + analyze as one overlay.
          setIsAnalyzingMeal(true);
          setShowScanOptions(false);
        },
      });

      if (result.status === 'canceled' || result.status === 'permission_denied') {
        return;
      }

      setScanPhotoCount(photoCount);
      setPendingMealSource(MEAL_SOURCE.PHOTO_GALLERY);
      setPendingPhotoUris(result.uris);
      await analyzeMealPhotos(result.uris);
    } finally {
      setIsPickingGalleryPhotos(false);
      // Clears overlay if prepareMealPhotoUri failed before analyzeMealPhotos ran.
      setIsAnalyzingMeal(false);
    }
  }

  async function analyzeMealPhotos(photoUris: string[]) {
    setIsAnalyzingMeal(true);

    try {
      let shouldIncrementAnonymousScan = false;

      if (userId) {
        const allowance = await checkScanAllowance(userId);
        if (allowance.isAnonymous && !allowance.allowed) {
          openPaywallBecauseScanLimit();
          return;
        }

        shouldIncrementAnonymousScan = allowance.isAnonymous;
      }

      const result = await MealVisionService.analyze(photoUris, i18n.language);

      if (result.kind === 'label') {
        // Transcribed densities: no foods lookup, no portion calibration.
        setVisionItems([labelToEditableItem(result.label, createRowItemId())]);
        setLabelContext({
          presetSource: labelQuantityPresetSource(result.label),
          plausibilityPassed: result.plausibility?.passed ?? null,
        });
      } else {
        const enrichedItems = await enrichVisionItemsWithResolvedFoods(
          result.items,
          i18n.language,
        );
        const calibratedItems = userId
          ? await applyUserFoodCalibration(userId, enrichedItems)
          : enrichedItems;
        setVisionItems(calibratedItems);
        setLabelContext(null);
      }

      setShowMealConfirmation(true);
      if (result.kind === 'label') {
        await deleteMealPhotoUris(photoUris);
      } else {
        // Deleted in handleMealConfirmationClose; never stored or uploaded for sharing.
        setResultPhotoUris(photoUris);
      }
      setPendingPhotoUris([]);
      setShowParseErrorSheet(false);
      setShowApiErrorSheet(false);

      if (userId && shouldIncrementAnonymousScan) {
        void incrementScanCount(userId)
          .then((scanNumber) => {
            trackAnonymousScanCompleted(scanNumber);
            return queryClient.invalidateQueries({ queryKey: scanAllowanceQueryKey(userId) });
          })
          .catch((incrementError) => {
            console.error('[Home] increment scan count failed:', incrementError);
          });
      }
    } catch (analysisError) {
      if (analysisError instanceof MealVisionRateLimitError) {
        setRateLimitResetAt(analysisError.resetAt);
        setShowRateLimitSheet(true);
        return;
      }

      if (analysisError instanceof MealVisionParseError) {
        setShowParseErrorSheet(true);
        return;
      }

      if (analysisError instanceof MealVisionApiError) {
        setShowApiErrorSheet(true);
        return;
      }

      setShowApiErrorSheet(true);
    } finally {
      setIsAnalyzingMeal(false);
    }
  }

  async function handleScanPhotosComplete(photoUris: string[]) {
    // Close camera + show analyzing before prepare so resize is covered by the same overlay.
    setShowCameraFlow(false);
    setIsAnalyzingMeal(true);
    setPendingMealSource(MEAL_SOURCE.PHOTO_CAMERA);

    try {
      // Sequential prepare avoids stacking multiple full-res decode buffers (WatchdogTermination).
      const preparedUris: string[] = [];
      for (const rawUri of photoUris) {
        preparedUris.push(await prepareMealPhotoUri(rawUri));
      }
      // Raw takePictureAsync files are no longer needed once prepared copies exist.
      await deleteMealPhotoUris(photoUris);
      setPendingPhotoUris(preparedUris);
      await analyzeMealPhotos(preparedUris);
    } catch {
      setIsAnalyzingMeal(false);
      setShowApiErrorSheet(true);
    }
  }

  async function handleParseErrorScanAgain() {
    setShowParseErrorSheet(false);
    await deleteMealPhotoUris(pendingPhotoUris);
    setPendingPhotoUris([]);
    setPendingMealSource(MEAL_SOURCE.PHOTO_CAMERA);
    setShowCameraFlow(true);
  }

  function handleParseErrorManualEntry() {
    setShowParseErrorSheet(false);
    setPendingPhotoUris([]);
    setVisionItems([]);
    setShowMealConfirmation(true);
  }

  async function handleApiErrorRetry() {
    if (pendingPhotoUris.length === 0) {
      setShowApiErrorSheet(false);
      return;
    }

    setShowApiErrorSheet(false);
    await analyzeMealPhotos(pendingPhotoUris);
  }

  function handleMealConfirmationClose() {
    setShowMealConfirmation(false);
    setVisionItems([]);
    if (resultPhotoUris.length > 0) {
      void deleteMealPhotoUris(resultPhotoUris);
      setResultPhotoUris([]);
    }
  }

  async function handleMealSave(items: EditableMealItem[], portionFactor = 1) {
    if (!userId) {
      return;
    }

    setIsSavingMeal(true);

    try {
      if (!isAnonymousUser && !(await gatePremiumAccess())) {
        beginPaywallAfterSheetDismiss();
        handleMealConfirmationClose();
        return;
      }

      await saveScannedMeal({
        userId,
        items,
        source: pendingMealSource,
        portionFactor,
      });
      void touchUserActivity(userId);
      await queryClient.invalidateQueries({ queryKey: ['home-dashboard', userId] });
      await queryClient.invalidateQueries({ queryKey: ['today-meals', userId] });
      await queryClient.invalidateQueries({ queryKey: ['day-meals', userId] });
      await queryClient.invalidateQueries({ queryKey: ['day-consumption', userId] });
      await queryClient.invalidateQueries({ queryKey: ['history', userId] });
      handleMealConfirmationClose();
      Sentry.captureMessage('push: ensurePushOnMealSave reached', {
        level: 'info',
        tags: { push_flow: 'reached' },
      });
      await ensurePushOnMealSave();
    } catch (saveError) {
      console.error('[Home] meal save failed:', saveError);
      Alert.alert(t('settings.errors.title'), t('home.scan.confirmation.saveError'));
    } finally {
      setIsSavingMeal(false);
    }
  }

  async function handleManualEntryPress() {
    if (!(await requirePremiumAccessToCapture())) {
      return;
    }

    setShowManualEntrySheet(true);
  }

  async function handleBarcodePress() {
    if (!(await requirePremiumAccessToCapture())) {
      return;
    }

    setBarcodeFlow({ kind: 'camera' });
  }

  const closeBarcodeFlow = useCallback(() => {
    barcodeLookupAbortRef.current?.abort();
    barcodeLookupAbortRef.current = null;
    pendingBarcodeRef.current = null;
    setPendingBarcode(null);
    setShowBarcodeLookupSlow(false);
    setBarcodeFlow({ kind: 'closed' });
  }, []);

  const closeProductLookup = useCallback(() => {
    productLookupAbortRef.current?.abort();
    productLookupAbortRef.current = null;
    setProductLookupFlow({ kind: 'closed' });
  }, []);

  const lookupProduct = useCallback(async (barcode: string) => {
    productLookupAbortRef.current?.abort();
    const controller = new AbortController();
    productLookupAbortRef.current = controller;
    setProductLookupFlow({ kind: 'loading' });

    try {
      const product = await fetchProductByBarcode(barcode, {
        signal: controller.signal,
        languageCode: i18n.language,
      });
      setProductLookupFlow({ kind: 'result', product });
    } catch (error) {
      if (error instanceof BarcodeLookupAbortedError) return;
      setProductLookupFlow({ kind: error instanceof BarcodeProductNotFoundError ? 'notFound' : 'lookupError' });
    } finally {
      if (productLookupAbortRef.current === controller) productLookupAbortRef.current = null;
    }
  }, [i18n.language]);

  function openProductLookup() {
    setProductLookupFlow({ kind: 'camera' });
  }

  const lookupBarcodeProduct = useCallback(async (barcode: string) => {
    barcodeLookupAbortRef.current?.abort();

    const controller = new AbortController();
    barcodeLookupAbortRef.current = controller;
    setBarcodeFlow({ kind: 'loading' });
    setShowBarcodeLookupSlow(false);

    try {
      const product = await fetchProductByBarcode(barcode, { signal: controller.signal });

      let foodId: string | null = null;
      try {
        foodId = await resolveFoodIdForOffProduct(barcodeProductToFoodSearchProduct(product));
      } catch (cacheError) {
        console.error('[Home] barcode foods cache failed:', cacheError);
      }

      setBarcodeFlow({ kind: 'quantity', product, foodId });
      pendingBarcodeRef.current = null;
      setPendingBarcode(null);
    } catch (lookupError) {
      if (lookupError instanceof BarcodeLookupAbortedError) {
        return;
      }

      if (lookupError instanceof BarcodeNutrimentsMissingError) {
        setBarcodeFlow({ kind: 'nutrimentsMissing' });
        return;
      }

      if (lookupError instanceof BarcodeProductNotFoundError) {
        setBarcodeFlow({ kind: 'notFound' });
        return;
      }

      setBarcodeFlow({ kind: 'lookupError' });
    } finally {
      if (barcodeLookupAbortRef.current === controller) {
        barcodeLookupAbortRef.current = null;
      }
      setShowBarcodeLookupSlow(false);
    }
  }, []);

  const handleBarcodeDetected = useCallback(
    (barcode: string) => {
      pendingBarcodeRef.current = barcode;
      setPendingBarcode(barcode);
      void lookupBarcodeProduct(barcode);
    },
    [lookupBarcodeProduct],
  );

  function handleBarcodeLookupRetry() {
    barcodeLookupAbortRef.current?.abort();
    barcodeLookupAbortRef.current = null;
    pendingBarcodeRef.current = null;
    setPendingBarcode(null);
    setShowBarcodeLookupSlow(false);
    setBarcodeFlow({ kind: 'camera' });
  }

  function handleBarcodeTakePhotoInstead() {
    closeBarcodeFlow();
    setScanPhotoCount(1);
    setPendingMealSource(MEAL_SOURCE.PHOTO_CAMERA);
    setShowCameraFlow(true);
  }

  async function handleBarcodeSave(items: MealItemRowItem[]) {
    if (!userId || barcodeFlow.kind !== 'quantity' || items.length === 0) {
      return;
    }

    setIsSavingBarcodeMeal(true);

    try {
      if (!(await gatePremiumAccess())) {
        beginPaywallAfterSheetDismiss();
        closeBarcodeFlow();
        return;
      }

      await saveScannedMeal({
        userId,
        items: rowItemsToEditable(items),
        source: MEAL_SOURCE.BARCODE,
      });
      void touchUserActivity(userId);

      await queryClient.invalidateQueries({ queryKey: ['home-dashboard', userId] });
      await queryClient.invalidateQueries({ queryKey: ['today-meals', userId] });
      await queryClient.invalidateQueries({ queryKey: ['day-meals', userId] });
      await queryClient.invalidateQueries({ queryKey: ['day-consumption', userId] });
      await queryClient.invalidateQueries({ queryKey: ['history', userId] });
      closeBarcodeFlow();
      Sentry.captureMessage('push: ensurePushOnMealSave reached', {
        level: 'info',
        tags: { push_flow: 'reached' },
      });
      await ensurePushOnMealSave();
    } catch (saveError) {
      console.error('[Home] barcode meal save failed:', saveError);
      Alert.alert(t('settings.errors.title'), t('home.scan.barcode.saveError'));
    } finally {
      setIsSavingBarcodeMeal(false);
    }
  }

  async function handleManualMealSave(items: EditableMealItem[]) {
    if (!userId) {
      return;
    }

    setIsSavingManualMeal(true);

    try {
      if (!(await gatePremiumAccess())) {
        beginPaywallAfterSheetDismiss();
        setShowManualEntrySheet(false);
        return;
      }

      await saveScannedMeal({
        userId,
        items,
        source: MEAL_SOURCE.MANUAL,
      });
      void touchUserActivity(userId);
      await queryClient.invalidateQueries({ queryKey: ['home-dashboard', userId] });
      await queryClient.invalidateQueries({ queryKey: ['today-meals', userId] });
      await queryClient.invalidateQueries({ queryKey: ['day-meals', userId] });
      await queryClient.invalidateQueries({ queryKey: ['day-consumption', userId] });
      await queryClient.invalidateQueries({ queryKey: ['history', userId] });
      setShowManualEntrySheet(false);
      Sentry.captureMessage('push: ensurePushOnMealSave reached', {
        level: 'info',
        tags: { push_flow: 'reached' },
      });
      await ensurePushOnMealSave();
    } catch (saveError) {
      console.error('[Home] manual meal save failed:', saveError);
      Alert.alert(t('settings.errors.title'), t('home.manualEntry.saveError'));
    } finally {
      setIsSavingManualMeal(false);
    }
  }

  function handleMealEditClose() {
    setEditingMealId(null);
  }

  async function handleMealEditSave(params: {
    mealId: string;
    items: Parameters<typeof updateMealWithItems>[0]['items'];
    removedMealItemIds: string[];
    portionFactor: number;
  }) {
    if (!userId) {
      return;
    }

    setIsSavingMealEdit(true);

    try {
      if (!isAnonymousUser && !(await gatePremiumAccess())) {
        beginPaywallAfterSheetDismiss();
        handleMealEditClose();
        return;
      }

      await updateMealWithItems({
        mealId: params.mealId,
        userId,
        items: params.items,
        removedMealItemIds: params.removedMealItemIds,
        portionFactor: params.portionFactor,
      });
      void touchUserActivity(userId);
      await queryClient.invalidateQueries({ queryKey: ['home-dashboard', userId] });
      await queryClient.invalidateQueries({ queryKey: ['today-meals', userId] });
      await queryClient.invalidateQueries({ queryKey: ['day-meals', userId] });
      await queryClient.invalidateQueries({ queryKey: ['day-consumption', userId] });
      await queryClient.invalidateQueries({ queryKey: ['history', userId] });
      setEditingMealId(null);
    } catch (saveError) {
      console.error('[Home] meal edit save failed:', saveError);
      Alert.alert(t('settings.errors.title'), t('home.mealEdit.saveError'));
    } finally {
      setIsSavingMealEdit(false);
    }
  }

  async function handleMealDelete(mealId: string) {
    if (!userId) {
      return;
    }

    if (!isAnonymousUser && !(await gatePremiumAccess())) {
      openPaywall({ withValuePitch: true });
      return;
    }

    setIsDeletingMeal(true);

    try {
      await deleteMeal({ mealId, userId });
      await queryClient.invalidateQueries({ queryKey: ['home-dashboard', userId] });
      await queryClient.invalidateQueries({ queryKey: ['today-meals', userId] });
      await queryClient.invalidateQueries({ queryKey: ['day-meals', userId] });
      await queryClient.invalidateQueries({ queryKey: ['day-consumption', userId] });
      await queryClient.invalidateQueries({ queryKey: ['history', userId] });
      setEditingMealId(null);
    } catch (deleteError) {
      console.error('[Home] meal delete failed:', deleteError);
      Alert.alert(t('settings.errors.title'), t('home.mealEdit.saveError'));
    } finally {
      setIsDeletingMeal(false);
    }
  }

  if (isLoading) {
    return (
      <HomeLayout>
        <HomeLoadingState />
      </HomeLayout>
    );
  }

  if (isError) {
    return (
      <HomeLayout>
        <HomeErrorState />
      </HomeLayout>
    );
  }

  return (
    <HomeLayout
      overlay={
        isAnalyzingMeal ? (
          <View
            pointerEvents="auto"
            style={StyleSheet.absoluteFill}
            className="z-50 items-center justify-center bg-black/55 px-6">
            <ActivityIndicator size="large" color="#FFFFFF" />
            <Text className="mt-4 text-center text-base font-medium text-white">
              {t('home.scan.confirmation.analyzing')}
            </Text>
          </View>
        ) : null
      }>
      <View className="absolute right-6 z-10 flex-row gap-2" style={{ top: contentTopPadding }}>
        {!isRegisteredProductLocked && !isProductAccessLoading ? (
          <Pressable accessibilityRole="button" accessibilityLabel={t('home.productLookup.iconLabel')} onPress={openProductLookup}>
            <View style={getGlassPillStyle(40)}>
              <Ionicons name="search-outline" size={22} color="#4F46E5" />
            </View>
          </Pressable>
        ) : null}
        <HistoryKoliButton
          accessibilityLabel={t('koli.title')}
          href={
            isRegisteredProductLocked
              ? ({
                  pathname: '/koli',
                  params: { segment: 'settings', settingsSubSegment: 'plan' },
                } as Href)
              : ('/koli' as Href)
          }
        />
      </View>
      <View className="flex-1">
        {/* AGB Ziffer 10 Abs. 5: every tab stays viewable without a plan. */}
        <GestureDetector gesture={homeTabSwipeGesture}>
          <View className="flex-1">
            <View className="px-6" style={{ paddingTop: contentTopPadding }}>
              <Text className="mb-4 pr-12 text-2xl font-bold text-gray-900">{greeting}</Text>

              {isAnonymousUser ? (
                <Pressable className="mb-2" onPress={() => navigateToSignIn()}>
                  <Text className="text-gray-500" style={{ fontSize: 11 }}>
                    {t('home.returningUser.prompt')}
                  </Text>
                </Pressable>
              ) : null}

              {isInTrial ? (
                trialDaysLeft === 0 ? (
                  <Pressable className="mb-2" onPress={() => openPaywall({ withValuePitch: false })}>
                    <Text className="text-gray-500" style={{ fontSize: 11 }}>
                      {t('home.trial.endsToday')}
                    </Text>
                  </Pressable>
                ) : (
                  <Text className="mb-2 text-gray-500" style={{ fontSize: 11 }}>
                    {t('home.trial.daysLeft', { count: trialDaysLeft })}
                  </Text>
                )
              ) : null}

              <View className="mb-5">
                <PillSegmentSwitcher
                  value={homeTab}
                  onChange={switchHomeTab}
                  compact={homeTabs.length >= 4}
                  segments={homeTabs.map((tab) => ({
                    id: tab,
                    testID: `home.tab.${tab}`,
                    label:
                      tab === 'meals' && homeTabs.length >= 4
                        ? t('home.tabs.mealsShort')
                        : t(`home.tabs.${tab}`),
                  }))}
                />
                {trainingTabEnabled && activeSession && homeTab !== 'training' ? (
                  <View className="mt-3">
                    <HomeActiveSessionBar onPress={() => switchHomeTab('training')} />
                  </View>
                ) : null}
              </View>
            </View>

            {homeTab === 'history' ? (
              <HistoryPanel
                onOpenWeightSheet={openCurrentWeightSheet}
                onOpenTrainingTab={() => switchHomeTab('training')}
              />
            ) : homeTab === 'training' ? (
              // No scan-bar padding here — the bar is hidden on this tab.
              <View
                className="flex-1 px-6"
                style={{ paddingBottom: Math.max(insets.bottom, 24) }}>
                <TrainingPanel
                  onEditPlan={() => router.push('/koli/workout-plan' as Href)}
                />
              </View>
            ) : (
              <ScrollView
                className="flex-1 px-6"
                contentContainerStyle={{
                  paddingBottom: hideScanButtons
                    ? Math.max(insets.bottom, 24)
                    : scanButtonBarScrollPadding(insets.bottom),
                }}
                showsVerticalScrollIndicator={false}>
                {homeTab === 'today' ? (
                  <>
                    <DaySummaryBlock date={localDateKey()} />

                    {activityRows.length > 0 ? (
                      <View
                        className="mt-4"
                        style={[getOnboardingIdleCardStyle(), { borderRadius: ONBOARDING_CARD_RADIUS }]}>
                        <View className="px-5 py-4">
                          <HomeProgressRows rows={activityRows} />
                        </View>
                      </View>
                    ) : null}

                    <View className="mt-6">
                      <WeightProgressCard
                        currentValue={weightLabel}
                        dailyValue={dailyWeightLabel}
                        startLabel={t('home.weight.startTitle')}
                        startValue={startWeightLabel}
                        targetLabel={t('home.weight.targetTitle')}
                        targetValue={targetWeightLabel}
                        progressPercent={weightProgressPercent}
                        accessibilityLabel={t('home.weight.label')}
                        onPress={openCurrentWeightSheet}
                      />
                    </View>

                    {showBuildUpToday ? (
                      <BuildUpCard
                        className="mt-4"
                        onOpenMeasurements={
                          measurementsAvailable ? () => setShowMeasurementsSheet(true) : undefined
                        }
                      />
                    ) : null}

                    <HomeSupplementChips />
                  </>
                ) : (
                  <DayMealList
                    date={localDateKey()}
                    editable
                    onMealPress={handleTodayMealPress}
                  />
                )}
              </ScrollView>
            )}
          </View>
        </GestureDetector>

        {!hideScanButtons ? (
        <View
          className="absolute left-0 right-0 items-center px-6"
          style={{ bottom: SCAN_BUTTON_BAR_GAP }}>
          <View className="flex-row items-end justify-center gap-5">
            <View className="items-center">
              <ManualEntryButton
                accessibilityLabel={t('home.manualEntry.buttonLabel')}
                onPress={() => void handleManualEntryPress()}
              />
              <Text
                className="text-sm font-medium text-gray-600"
                style={{
                  marginTop: SCAN_BUTTON_LABEL_GAP,
                  lineHeight: SCAN_BUTTON_LABEL_LINE_HEIGHT,
                }}>
                {t('home.manualEntry.buttonLabel')}
              </Text>
            </View>

            <View className="items-center">
              <ScanMealButton
                accessibilityLabel={t('home.scan.buttonLabel')}
                onPress={() => void handleScanPress()}
              />
              <Text
                className="text-sm font-medium text-gray-600"
                style={{
                  marginTop: SCAN_BUTTON_LABEL_GAP,
                  lineHeight: SCAN_BUTTON_LABEL_LINE_HEIGHT,
                }}>
                {t('home.scan.buttonLabel')}
              </Text>
            </View>

            <View className="items-center">
              <BarcodeScanButton
                accessibilityLabel={t('home.scan.barcodeLabel')}
                onPress={() => void handleBarcodePress()}
              />
              <Text
                className="text-sm font-medium text-gray-600"
                style={{
                  marginTop: SCAN_BUTTON_LABEL_GAP,
                  lineHeight: SCAN_BUTTON_LABEL_LINE_HEIGHT,
                }}>
                {t('home.scan.barcodeLabel')}
              </Text>
            </View>
          </View>
          {scanAllowance?.isAnonymous && scanAllowance.remaining === 1 ? (
            <Text className="mt-3 text-center text-gray-500" style={{ fontSize: 11 }}>
              {t('home.scan.oneFreeScanLeft')}
            </Text>
          ) : null}
        </View>
        ) : null}
      </View>

      <ScanOptionsSheet
        visible={showScanOptions}
        onClose={() => setShowScanOptions(false)}
        onCapture={handleScanCapture}
        onPickFromGallery={(photoCount) => void handleGalleryPick(photoCount)}
      />

      <MultiPhotoCameraFlow
        visible={showCameraFlow}
        photoCount={scanPhotoCount}
        onCancel={() => setShowCameraFlow(false)}
        onComplete={(photoUris) => void handleScanPhotosComplete(photoUris)}
      />

      <MealConfirmationSheet
        visible={showMealConfirmation}
        items={visionItems}
        isSaving={isSavingMeal}
        labelContext={labelContext}
        onClose={handleMealConfirmationClose}
        onDismissed={handleMealSheetDismissed}
        onSave={(items, portionFactor) => void handleMealSave(items, portionFactor)}
        photoUri={resultPhotoUris[0] ?? null}
      />

      <ScanRateLimitSheet
        visible={showRateLimitSheet}
        resetAt={rateLimitResetAt}
        onClose={() => setShowRateLimitSheet(false)}
      />

      <ScanParseErrorSheet
        visible={showParseErrorSheet}
        onClose={() => setShowParseErrorSheet(false)}
        onScanAgain={() => void handleParseErrorScanAgain()}
        onManualEntry={handleParseErrorManualEntry}
      />

      <ScanApiErrorSheet
        visible={showApiErrorSheet}
        onClose={() => setShowApiErrorSheet(false)}
        onRetry={() => void handleApiErrorRetry()}
      />

      <BarcodeFlowModal
        state={barcodeFlow}
        isSaving={isSavingBarcodeMeal}
        showLookupSlow={showBarcodeLookupSlow}
        onClose={closeBarcodeFlow}
        onDismissed={handleMealSheetDismissed}
        onBarcodeScanned={handleBarcodeDetected}
        onSaveItems={(items) => void handleBarcodeSave(items)}
        onRetryLookup={() => void handleBarcodeLookupRetry()}
        onTakePhotoInstead={handleBarcodeTakePhotoInstead}
      />

      <ProductLookupModal
        state={productLookupFlow}
        onClose={closeProductLookup}
        onBarcodeScanned={(barcode) => void lookupProduct(barcode)}
        onScanAnother={() => setProductLookupFlow({ kind: 'camera' })}
      />

      <ManualMealEntrySheet
        visible={showManualEntrySheet}
        isSaving={isSavingManualMeal}
        onClose={() => setShowManualEntrySheet(false)}
        onDismissed={handleMealSheetDismissed}
        onSave={(items) => void handleManualMealSave(items)}
      />

      <MealEditSheet
        visible={editingMealId != null}
        mealId={editingMealId}
        userId={userId ?? null}
        isSaving={isSavingMealEdit}
        isDeleting={isDeletingMeal}
        onClose={handleMealEditClose}
        onDismissed={handleMealSheetDismissed}
        onSave={(params) => void handleMealEditSave(params)}
        onDeleteMeal={(mealId) => void handleMealDelete(mealId)}
      />


      <MeasurementsSheet
        visible={showMeasurementsSheet}
        onClose={() => setShowMeasurementsSheet(false)}
      />
      <WeightInputSheet
        visible={weightSheet != null}
        title={t('home.weight.modalTitle')}
        subtitle={
          hasWeightLogToday ? t('home.weight.modalSubtitle') : null
        }
        unitSystem={unitSystem}
        value={weightDraft}
        waistValue={waistDraft}
        bodyFatValue={bodyFatDraft}
        isSaving={isSavingWeight}
        onChange={setWeightDraft}
        onWaistChange={setWaistDraft}
        onBodyFatChange={setBodyFatDraft}
        onClose={closeWeightSheet}
        onLoggedDateChange={(loggedOn) => {
          void loadWeightSheetDraftsForDay(loggedOn);
        }}
        onSave={(loggedOn) => void saveCurrentWeight(loggedOn)}
      />

      <PaywallSheet
        visible={showPaywall}
        userId={userId}
        withValuePitch={paywallWithValuePitch}
        onClose={closePaywall}
      />
    </HomeLayout>
  );
}
