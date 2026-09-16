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
import { HomeProgressRows, type HomeProgressRowItem } from '@/components/home/home-progress-rows';
import { HomeSupplementChips } from '@/components/home/HomeSupplementChips';
import { PillSegmentSwitcher } from '@/components/koli/pill-segment-switcher';
import {
  WeightProgressCard,
  weightGoalProgressPercent,
} from '@/components/home/weight-progress-card';
import { WeightInputSheet } from '@/components/home/weight-update-sheet';
import { PaywallSheet } from '@/components/paywall/PaywallSheet';
import { useHomeDashboard } from '@/hooks/use-home-dashboard';
import { useTrialStatus } from '@/hooks/use-premium-access';
import { useRevenueCatPremiumEntitlement } from '@/hooks/use-revenuecat-premium-entitlement';
import { useHealthConnectedPreference } from '@/hooks/use-health-connected-preference';
import { useTrainingSessionsWeek } from '@/hooks/use-training-sessions-week';
import { useMovementGoalActual } from '@/hooks/use-movement-goal-actual';
import { localDateKey } from '@/lib/day-window';
import {
  getTimeOfDay,
  resolveDisplayName,
} from '@/lib/home';
import { countDistinctTrainingDays, weekDotFlags } from '@/lib/training-sessions';
import { kgToLbs } from '@/lib/units';
import {
  formatWeightForDisplay,
  parseWeightInputToKg,
  upsertTodayWeightLog,
} from '@/lib/weight-logs';
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
import { fetchHasPremiumAccess } from '@/lib/subscription';
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
import { useOnboardingStore } from '@/stores/onboarding-store';
import { createChunkedSecureStoreAdapter } from '@/lib/chunked-secure-store';

const MAX_WEIGHT_KG = 699.9;
const SIGNUP_ROUTE = '/(auth)/login' as Href;

type HomeTab = 'today' | 'meals';
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
  const { contentTopPadding } = useMeshScreenInsets();
  const queryClient = useQueryClient();
  const session = useAuthStore((state) => state.session);
  const userId = session?.user?.id;
  const unitSystem = useOnboardingStore((state) => state.unitSystem);
  const initializeUnitSystem = useOnboardingStore((state) => state.initializeUnitSystem);
  const { data, isLoading, isError, error } = useHomeDashboard();
  const { data: healthConnectedPreference = false } = useHealthConnectedPreference(userId);
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
  const { isInTrial, daysLeft: trialDaysLeft } = useTrialStatus(userId);
  const { isPremiumEntitlementActive } = useRevenueCatPremiumEntitlement();
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
  const isAnonymousUser = session?.user?.is_anonymous === true;

  const [showPaywall, setShowPaywall] = useState(false);
  const [paywallWithValuePitch, setPaywallWithValuePitch] = useState(false);
  const [homeTab, setHomeTab] = useState<HomeTab>('today');
  const [weightSheet, setWeightSheet] = useState<WeightSheetKind>(null);
  const [weightDraft, setWeightDraft] = useState('');
  const [isSavingWeight, setIsSavingWeight] = useState(false);
  const [showScanOptions, setShowScanOptions] = useState(false);
  const [showCameraFlow, setShowCameraFlow] = useState(false);
  const [scanPhotoCount, setScanPhotoCount] = useState(1);
  const [isAnalyzingMeal, setIsAnalyzingMeal] = useState(false);
  const [showMealConfirmation, setShowMealConfirmation] = useState(false);
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
  const barcodeLookupAbortRef = useRef<AbortController | null>(null);
  const productLookupAbortRef = useRef<AbortController | null>(null);
  const [showManualEntrySheet, setShowManualEntrySheet] = useState(false);
  const [isSavingManualMeal, setIsSavingManualMeal] = useState(false);
  const [editingMealId, setEditingMealId] = useState<string | null>(null);
  const [isSavingMealEdit, setIsSavingMealEdit] = useState(false);
  const [isDeletingMeal, setIsDeletingMeal] = useState(false);

  const switchHomeTab = useCallback((tab: HomeTab) => {
    setHomeTab(tab);
  }, []);

  const homeTabSwipeGesture = useMemo(
    () =>
      Gesture.Pan()
        .activeOffsetX([-24, 24])
        .failOffsetY([-16, 16])
        .onEnd((event) => {
          'worklet';
          const distance = 56;
          const flick = 450;
          const toMeals =
            event.translationX < -distance || event.velocityX < -flick;
          const toToday =
            event.translationX > distance || event.velocityX > flick;

          if (toMeals) {
            runOnJS(switchHomeTab)('meals');
          } else if (toToday) {
            runOnJS(switchHomeTab)('today');
          }
        }),
    [switchHomeTab],
  );

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

  const gatePremiumAccess = useCallback(async (): Promise<boolean> => {
    if (!userId) {
      return false;
    }

    // RevenueCat entitlement is the immediate source of truth after purchase/restore.
    // DB has_premium_access() lags behind the webhook and may still be cached as false.
    if (isPremiumEntitlementActive) {
      return true;
    }

    try {
      const hasAccess = await queryClient.ensureQueryData({
        queryKey: ['has-premium-access', userId, isAnonymousUser],
        queryFn: () => fetchHasPremiumAccess(userId),
        staleTime: 60 * 1000,
      });

      return hasAccess === true;
    } catch (gateError) {
      console.error('[Home] premium access check failed:', gateError);
      return false;
    }
  }, [isPremiumEntitlementActive, queryClient, userId]);

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

  useEffect(() => {
    return () => {
      if (paywallDismissTimerRef.current) {
        clearTimeout(paywallDismissTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    initializeUnitSystem();
  }, [initializeUnitSystem]);

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
          : t('home.movementGoal.unitKm');
      const actual = movementActual ?? 0;

      rows.push({
        key: 'movement',
        label:
          movementGoalType === 'steps'
            ? t('home.movementGoal.labelSteps')
            : movementGoalType === 'running_km'
              ? t('home.movementGoal.labelRunningKm')
              : t('home.movementGoal.labelDistanceKm'),
        actual,
        goal: movementGoalValue,
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
        actual: countDistinctTrainingDays(trainingSessionsWeek),
        goal: trainingSessionsPerWeek,
        decimals: 0 as const,
        dividerAbove: rows.length > 0,
        weekDayDots: weekDotFlags(trainingSessionsWeek),
        onPress: () => {
          router.push('/koli/training-log' as Href);
        },
      });
    }

    return rows;
  }, [
    trainingSessionsPerWeek,
    trainingSessionsWeek,
    hasTrainingGoal,
    hasMovementGoal,
    healthConnectedPreference,
    movementActual,
    movementGoalType,
    movementGoalValue,
    t,
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
  const startWeightKg = data?.startWeightKg ?? null;
  const weightUnitLabels = useMemo(
    () => ({
      kgLabel: t('onboarding.units.kg'),
      lbsLabel: t('onboarding.units.lbs'),
    }),
    [t],
  );

  const weightLabel = useMemo(() => {
    if (latestWeightKg == null) {
      return t('home.weight.notLogged');
    }

    return formatWeightForDisplay({
      weightKg: latestWeightKg,
      unitSystem,
      ...weightUnitLabels,
    });
  }, [latestWeightKg, t, unitSystem, weightUnitLabels]);

  const weightProgressPercent = useMemo(
    () =>
      weightGoalProgressPercent({
        startKg: startWeightKg,
        currentKg: latestWeightKg,
        targetKg: targetWeightKg,
      }),
    [latestWeightKg, startWeightKg, targetWeightKg],
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

  function openCurrentWeightSheet() {
    setWeightDraft(weightKgToDraft(latestWeightKg));
    setWeightSheet('current');
  }

  function closeWeightSheet() {
    setWeightSheet(null);
  }

  async function saveCurrentWeight() {
    if (!userId) {
      return;
    }

    const weightKg = parseWeightInputToKg({ value: weightDraft, unitSystem });
    if (weightKg == null || weightKg >= MAX_WEIGHT_KG) {
      Alert.alert(t('settings.errors.title'), t('home.weight.invalid'));
      return;
    }

    setIsSavingWeight(true);

    try {
      await upsertTodayWeightLog({ userId, weightKg });
      await queryClient.invalidateQueries({ queryKey: ['home-dashboard', userId] });
      await queryClient.invalidateQueries({ queryKey: ['macro-goal-editor', userId] });
      await queryClient.invalidateQueries({ queryKey: ['profile-settings', userId] });
      await queryClient.invalidateQueries({ queryKey: ['history', userId] });
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
      await deleteMealPhotoUris(photoUris);
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
        <Pressable accessibilityRole="button" accessibilityLabel={t('home.productLookup.iconLabel')} onPress={openProductLookup}>
          <View style={getGlassPillStyle(40)}>
            <Ionicons name="search-outline" size={22} color="#4F46E5" />
          </View>
        </Pressable>
        <HistoryKoliButton accessibilityLabel={t('koli.title')} />
      </View>
      <View className="flex-1">
        <GestureDetector gesture={homeTabSwipeGesture}>
          <ScrollView
            className="flex-1 px-6"
            contentContainerStyle={{ paddingTop: contentTopPadding, paddingBottom: 120 }}
            showsVerticalScrollIndicator={false}>
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
                onChange={setHomeTab}
                segments={[
                  { id: 'today', label: t('home.tabs.today') },
                  { id: 'meals', label: t('home.tabs.meals') },
                ]}
              />
            </View>

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
                    startLabel={t('home.weight.startTitle')}
                    startValue={startWeightLabel}
                    targetLabel={t('home.weight.targetTitle')}
                    targetValue={targetWeightLabel}
                    progressPercent={weightProgressPercent}
                    accessibilityLabel={t('home.weight.label')}
                    onPress={openCurrentWeightSheet}
                  />
                </View>

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
        </GestureDetector>

        <View className="absolute bottom-8 left-0 right-0 items-center px-6">
          <View className="flex-row items-end justify-center gap-5">
            <View className="items-center">
              <ManualEntryButton
                accessibilityLabel={t('home.manualEntry.buttonLabel')}
                onPress={() => void handleManualEntryPress()}
              />
              <Text className="mt-3 text-sm font-medium text-gray-600">
                {t('home.manualEntry.buttonLabel')}
              </Text>
            </View>

            <View className="items-center">
              <ScanMealButton
                accessibilityLabel={t('home.scan.buttonLabel')}
                onPress={() => void handleScanPress()}
              />
              <Text className="mt-3 text-sm font-medium text-gray-600">
                {t('home.scan.buttonLabel')}
              </Text>
            </View>

            <View className="items-center">
              <BarcodeScanButton
                accessibilityLabel={t('home.scan.barcodeLabel')}
                onPress={() => void handleBarcodePress()}
              />
              <Text className="mt-3 text-sm font-medium text-gray-600">
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


      <WeightInputSheet
        visible={weightSheet != null}
        title={t('home.weight.modalTitle')}
        subtitle={
          hasWeightLogToday ? t('home.weight.modalSubtitle') : null
        }
        unitSystem={unitSystem}
        value={weightDraft}
        isSaving={isSavingWeight}
        onChange={setWeightDraft}
        onClose={closeWeightSheet}
        onSave={() => void saveCurrentWeight()}
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
