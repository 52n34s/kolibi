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
import { useQuery, useQueryClient } from '@tanstack/react-query';

import { HomeLayout, useMeshScreenInsets } from '@/components/home/home-layout';
import { BarcodeScanButton } from '@/components/home/BarcodeScanButton';
import { HistoryKoliButton } from '@/components/home/history-koli-button';
import { ManualEntryButton } from '@/components/home/ManualEntryButton';
import { ScanMealButton } from '@/components/home/ScanMealButton';
import { BarcodeFlowModal, type BarcodeFlowState } from '@/components/scan/BarcodeFlowModal';
import {
  rowItemsToEditable,
  type MealItemRowItem,
} from '@/components/scan/meal-item-row-model';
import { ManualMealEntrySheet } from '@/components/scan/ManualMealEntrySheet';
import { MealEditSheet } from '@/components/scan/MealEditSheet';
import { MealConfirmationSheet } from '@/components/scan/MealConfirmationSheet';
import { MultiPhotoCameraFlow } from '@/components/scan/MultiPhotoCameraFlow';
import { ScanApiErrorSheet } from '@/components/scan/ScanApiErrorSheet';
import { ScanOptionsSheet } from '@/components/scan/ScanOptionsSheet';
import { ScanParseErrorSheet } from '@/components/scan/ScanParseErrorSheet';
import { ScanRateLimitSheet } from '@/components/scan/ScanRateLimitSheet';
import {
  getOnboardingIdleCardStyle,
  getOnboardingSecondarySurfaceStyle,
  ONBOARDING_ACCENT,
  ONBOARDING_CARD_RADIUS,
} from '@/components/onboarding/onboarding-styles';
import { GLASS_SURFACE_PRESSED } from '@/components/ui/glass-styles';
import { BRAND_INDIGO } from '@/constants/brand';
import { NutrientTileGrid } from '@/components/home/nutrient-tile-grid';
import { TodayMealsSection } from '@/components/home/TodayMealsSection';
import { WeightMetricCard } from '@/components/home/weight-metric-card';
import { WeightInputSheet } from '@/components/home/weight-update-sheet';
import { PaywallSheet } from '@/components/paywall/PaywallSheet';
import { useHomeDashboard } from '@/hooks/use-home-dashboard';
import { useTodayMeals } from '@/hooks/use-today-meals';
import { useHasPremiumAccess, useTrialStatus } from '@/hooks/use-premium-access';
import { useRevenueCatPremiumEntitlement } from '@/hooks/use-revenuecat-premium-entitlement';
import { useHealthConnectedPreference } from '@/hooks/use-health-connected-preference';
import { useActiveEnergyBurnedToday } from '@/hooks/use-active-energy-burned';
import { formatKcal } from '@/utils/format';
import {
  getTimeOfDay,
  getCalorieGoalDisplay,
  getDynamicCalorieGoalDisplay,
  resolveDisplayName,
} from '@/lib/home';
import { buildHomeNutrientTileEntries } from '@/lib/home-nutrients';
import { kgToLbs } from '@/lib/units';
import {
  formatWeightForDisplay,
  formatWeightDeltaForDisplay,
  parseWeightInputToKg,
  updateTargetWeightKg,
  upsertTodayWeightLog,
} from '@/lib/weight-logs';
import {
  saveScannedMeal,
  deleteMeal,
  updateMealWithItems,
  type TodayMeal,
} from '@/lib/meals';
import { registerForPushNotifications, PUSH_PERMISSION_ASKED_KEY } from '@/lib/notifications';
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
import { enrichVisionItemsWithResolvedFoods } from '@/lib/resolve-foods';
import { resolveFoodIdForOffProduct } from '@/lib/foods-cache';
import {
  MealVisionApiError,
  MealVisionParseError,
  MealVisionRateLimitError,
  MealVisionService,
} from '@/services/mealVision/MealVisionService';
import type { EditableMealItem } from '@/services/mealVision/types';
import { useAuthStore } from '@/stores/auth-store';
import { useOnboardingStore } from '@/stores/onboarding-store';
import { createChunkedSecureStoreAdapter } from '@/lib/chunked-secure-store';

/** Dev-only: set e.g. 2269 to preview over-goal layout in the simulator */
const DEV_PREVIEW_CONSUMED_CALORIES = 0;

const CALORIE_GOAL_ACCENT = '#4F46E5';
const CALORIE_OVER_GOAL_COLOR = '#D97706';
const MAX_WEIGHT_KG = 699.9;
const SIGNUP_ROUTE = '/(auth)/login' as Href;

type WeightSheetKind = 'current' | 'target' | null;

function navigateToSignup() {
  router.push(SIGNUP_ROUTE);
}

function navigateToSignupBecauseScanLimit() {
  trackAnonymousLimitReached();
  navigateToSignup();
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
  const { data: todayMeals, isLoading: isTodayMealsLoading } = useTodayMeals();
  const { data: healthConnectedPreference = false } = useHealthConnectedPreference(userId);
  const { data: activeEnergyBurnedToday } = useActiveEnergyBurnedToday(
    healthConnectedPreference === true,
  );
  useHasPremiumAccess(userId);
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
  const [weightSheet, setWeightSheet] = useState<WeightSheetKind>(null);
  const [weightDraft, setWeightDraft] = useState('');
  const [isSavingWeight, setIsSavingWeight] = useState(false);
  const [showScanOptions, setShowScanOptions] = useState(false);
  const [showCameraFlow, setShowCameraFlow] = useState(false);
  const [scanPhotoCount, setScanPhotoCount] = useState(1);
  const [isAnalyzingMeal, setIsAnalyzingMeal] = useState(false);
  const [showMealConfirmation, setShowMealConfirmation] = useState(false);
  const [visionItems, setVisionItems] = useState<EditableMealItem[]>([]);
  const [isSavingMeal, setIsSavingMeal] = useState(false);
  const [showRateLimitSheet, setShowRateLimitSheet] = useState(false);
  const [rateLimitResetAt, setRateLimitResetAt] = useState<string | null>(null);
  const [showParseErrorSheet, setShowParseErrorSheet] = useState(false);
  const [showApiErrorSheet, setShowApiErrorSheet] = useState(false);
  const [pendingPhotoUris, setPendingPhotoUris] = useState<string[]>([]);
  const [pendingMealSource, setPendingMealSource] = useState<MealSource>(MEAL_SOURCE.PHOTO_CAMERA);
  const [isPickingGalleryPhotos, setIsPickingGalleryPhotos] = useState(false);
  const [barcodeFlow, setBarcodeFlow] = useState<BarcodeFlowState>({ kind: 'closed' });
  const [pendingBarcode, setPendingBarcode] = useState<string | null>(null);
  const pendingBarcodeRef = useRef<string | null>(null);
  const pendingPaywallRef = useRef(false);
  const paywallDismissTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [isSavingBarcodeMeal, setIsSavingBarcodeMeal] = useState(false);
  const [showBarcodeLookupSlow, setShowBarcodeLookupSlow] = useState(false);
  const barcodeLookupAbortRef = useRef<AbortController | null>(null);
  const [showManualEntrySheet, setShowManualEntrySheet] = useState(false);
  const [isSavingManualMeal, setIsSavingManualMeal] = useState(false);
  const [editingMealId, setEditingMealId] = useState<string | null>(null);
  const [isSavingMealEdit, setIsSavingMealEdit] = useState(false);
  const [isDeletingMeal, setIsDeletingMeal] = useState(false);

  const secureStore = useMemo(() => createChunkedSecureStoreAdapter(), []);

  const maybeAskForPushAfterFirstMeal = useCallback(async () => {
    if (!userId) {
      return;
    }

    const stored = await secureStore.getItem(PUSH_PERMISSION_ASKED_KEY);
    Sentry.addBreadcrumb({
      category: 'push-debug',
      message: 'maybeAskForPushAfterFirstMeal: push_permission_asked',
      level: 'info',
      data: { secureStoreFlag: stored, userId },
    });

    if (stored !== 'true') {
      const result = await registerForPushNotifications(userId);

      if (result.status === 'granted' || result.status === 'denied') {
        await secureStore.setItem(PUSH_PERMISSION_ASKED_KEY, 'true');
      }
    }

    Sentry.captureMessage('push-debug: flow completed', {
      level: 'info',
      tags: { flow: 'push-permission' },
    });
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

  const hasCalorieGoalSource = data?.profile?.calorie_goal_source != null;
  const dailyCalorieGoal = data?.latestCalorieGoal?.daily_calorie_goal ?? null;
  const hasCalorieGoal = hasCalorieGoalSource && dailyCalorieGoal != null;
  const consumedCaloriesToday = __DEV__
    ? DEV_PREVIEW_CONSUMED_CALORIES || (data?.consumedCaloriesToday ?? 0)
    : (data?.consumedCaloriesToday ?? 0);

  const calorieGoalDisplay = useMemo(() => {
    if (!hasCalorieGoal || dailyCalorieGoal == null) {
      return null;
    }

    if (
      healthConnectedPreference &&
      activeEnergyBurnedToday != null
    ) {
      return getDynamicCalorieGoalDisplay(
        dailyCalorieGoal,
        consumedCaloriesToday,
        activeEnergyBurnedToday,
      );
    }

    return getCalorieGoalDisplay(dailyCalorieGoal, consumedCaloriesToday);
  }, [
    activeEnergyBurnedToday,
    consumedCaloriesToday,
    dailyCalorieGoal,
    hasCalorieGoal,
    healthConnectedPreference,
  ]);

  const calorieBarWidthPercent = useMemo(() => {
    if (calorieGoalDisplay == null) {
      return 0;
    }

    if (calorieGoalDisplay.isOverGoal) {
      return 100;
    }

    const goal =
      calorieGoalDisplay.mode === 'dynamic'
        ? calorieGoalDisplay.dailyGoal + (calorieGoalDisplay.activeEnergyBurned ?? 0)
        : calorieGoalDisplay.dailyGoal;

    if (goal <= 0) {
      return 0;
    }

    return Math.min(100, Math.max(0, (calorieGoalDisplay.consumedToday / goal) * 100));
  }, [calorieGoalDisplay]);

  const nutrientTiles = useMemo(() => {
    const macros = data?.consumedMacrosToday;
    return buildHomeNutrientTileEntries({
      dietPreference: data?.profile?.diet_preference,
      labels: {
        protein: t('home.nutrients.protein'),
        carbs: t('home.nutrients.carbs'),
        fat: t('home.nutrients.fat'),
        fiber: t('home.nutrients.fiber'),
      },
      totals: {
        protein: macros?.proteinG ?? null,
        carbs: macros?.carbsG ?? null,
        fat: macros?.fatG ?? null,
        fiber: macros?.fiberG ?? null,
      },
      unit: t('home.nutrients.unitGrams'),
    });
  }, [data?.consumedMacrosToday, data?.profile?.diet_preference, t]);

  const latestWeightKg = data?.latestWeight?.weight_kg ?? null;
  const targetWeightKg = data?.profile?.target_weight_kg ?? null;
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

  const targetWeightLabel = useMemo(() => {
    if (targetWeightKg == null) {
      return t('home.weight.targetNotSet');
    }

    return formatWeightForDisplay({
      weightKg: targetWeightKg,
      unitSystem,
      ...weightUnitLabels,
    });
  }, [targetWeightKg, t, unitSystem, weightUnitLabels]);

  const targetWeightDeltaHint = useMemo(() => {
    if (targetWeightKg == null || latestWeightKg == null) {
      return null;
    }

    return formatWeightDeltaForDisplay({
      deltaKg: targetWeightKg - latestWeightKg,
      unitSystem,
      ...weightUnitLabels,
    })?.replace(/\s+\S+$/, '').replace(/^-/, '\u2212') ?? null;
  }, [latestWeightKg, targetWeightKg, unitSystem, weightUnitLabels]);

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

  function openTargetWeightSheet() {
    setWeightDraft(weightKgToDraft(targetWeightKg));
    setWeightSheet('target');
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

  async function saveTargetWeight() {
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
      await updateTargetWeightKg({ userId, targetWeightKg: weightKg });
      await queryClient.invalidateQueries({ queryKey: ['home-dashboard', userId] });
      await queryClient.invalidateQueries({ queryKey: ['profile-settings', userId] });
      closeWeightSheet();
    } catch (saveError) {
      console.error('[Home] target weight save failed:', saveError);
      Alert.alert(t('settings.errors.title'), t('home.weight.saveFailed'));
    } finally {
      setIsSavingWeight(false);
    }
  }

  function openCalorieGoalSettings() {
    router.push('/koli/calorie-goal' as Href);
  }

  async function handleScanPress() {
    if (!userId) {
      return;
    }

    const allowance = await checkScanAllowance(userId);
    if (allowance.isAnonymous) {
      if (!allowance.allowed) {
        navigateToSignupBecauseScanLimit();
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
          navigateToSignupBecauseScanLimit();
          return;
        }

        shouldIncrementAnonymousScan = allowance.isAnonymous;
      }

      const result = await MealVisionService.analyze(photoUris);
      const enrichedItems = await enrichVisionItemsWithResolvedFoods(
        result.items,
        i18n.language,
      );
      setVisionItems(enrichedItems);
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
      await queryClient.invalidateQueries({ queryKey: ['history', userId] });
      handleMealConfirmationClose();
      await maybeAskForPushAfterFirstMeal();
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
      await queryClient.invalidateQueries({ queryKey: ['history', userId] });
      closeBarcodeFlow();
      await maybeAskForPushAfterFirstMeal();
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
      await queryClient.invalidateQueries({ queryKey: ['history', userId] });
      setShowManualEntrySheet(false);
      await maybeAskForPushAfterFirstMeal();
    } catch (saveError) {
      console.error('[Home] manual meal save failed:', saveError);
      Alert.alert(t('settings.errors.title'), t('home.manualEntry.saveError'));
    } finally {
      setIsSavingManualMeal(false);
    }
  }

  function handleTodayMealPress(meal: TodayMeal) {
    setEditingMealId(meal.id);
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
      <View className="absolute right-6 z-10" style={{ top: contentTopPadding }}>
        <HistoryKoliButton accessibilityLabel={t('koli.title')} />
      </View>
      <View className="flex-1">
        <ScrollView
          className="flex-1 px-6"
          contentContainerStyle={{ paddingTop: contentTopPadding, paddingBottom: 120 }}
          showsVerticalScrollIndicator={false}>
          <Text className="mb-6 pr-12 text-2xl font-bold text-gray-900">{greeting}</Text>

          {isAnonymousUser ? (
            <Pressable className="mt-1 mb-2" onPress={() => navigateToSignIn()}>
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

          {calorieGoalDisplay ? (
            <View style={[getOnboardingIdleCardStyle(), { borderRadius: ONBOARDING_CARD_RADIUS }]}>
              <View className="px-5 py-6">
                <View style={styles.calorieHeroRow}>
                  <View style={styles.calorieHeroLeft}>
                    <Text style={styles.calorieHeroLabel}>
                      {t(
                        calorieGoalDisplay.mode === 'dynamic'
                          ? 'home.calorieGoal.dynamicLabel'
                          : 'home.calorieGoal.label',
                      )}
                    </Text>
                    <Text
                      style={[
                        styles.calorieHeroValue,
                        {
                          color: calorieGoalDisplay.isOverGoal
                            ? CALORIE_OVER_GOAL_COLOR
                            : CALORIE_GOAL_ACCENT,
                        },
                      ]}>
                      {formatKcal(calorieGoalDisplay.mainValue)}
                    </Text>
                  </View>
                  <View style={styles.calorieHeroGrid}>
                    <Text style={styles.calorieHeroLabel}>{t('home.nutrients.eaten')}</Text>
                    <NutrientTileGrid items={nutrientTiles} />
                  </View>
                </View>
                <View
                  style={{
                    height: 4,
                    borderRadius: 2,
                    overflow: 'hidden',
                    marginTop: 16,
                    marginBottom: 8,
                    backgroundColor: 'rgba(79, 70, 229, 0.13)',
                  }}>
                  <View
                    style={{
                      height: '100%',
                      width: `${calorieBarWidthPercent}%`,
                      borderRadius: 2,
                      backgroundColor: calorieGoalDisplay.isOverGoal
                        ? CALORIE_OVER_GOAL_COLOR
                        : BRAND_INDIGO,
                    }}
                  />
                </View>
                {calorieGoalDisplay.showOverLabel ? (
                  <Text className="mt-2 text-base font-medium text-amber-700">
                    {t('home.calorieGoal.overGoal')}
                  </Text>
                ) : null}
                <Text
                  className={`text-sm text-gray-500 ${calorieGoalDisplay.showOverLabel ? 'mt-1' : 'mt-2'}`}>
                  {calorieGoalDisplay.mode === 'dynamic'
                    ? t('home.calorieGoal.dynamicDailyGoalReference', {
                        goal: formatKcal(calorieGoalDisplay.dailyGoalContextValue),
                        burned: formatKcal(calorieGoalDisplay.activeEnergyBurned ?? 0),
                      })
                    : t('home.calorieGoal.dailyGoalReference', {
                        goal: formatKcal(calorieGoalDisplay.dailyGoalContextValue),
                      })}
                </Text>
              </View>
            </View>
          ) : (
            <View style={getOnboardingSecondarySurfaceStyle()}>
              <Pressable
                onPress={openCalorieGoalSettings}
                style={({ pressed }) => [
                  pressed && { backgroundColor: GLASS_SURFACE_PRESSED.backgroundColor },
                ]}>
                <View className="flex-row items-center px-4 py-3">
                  <Text className="flex-1 text-sm text-gray-500">
                    {t('home.calorieGoal.emptyPrefix')}
                    <Text className="font-medium text-[#4F46E5]">
                      {t('home.calorieGoal.emptyAction')}
                    </Text>
                  </Text>
                  <Ionicons name="chevron-forward" size={16} color="#9CA3AF" />
                </View>
              </Pressable>
            </View>
          )}

          <View className="mt-4 flex-row items-stretch gap-3">
            <WeightMetricCard
              label={t('home.weight.label')}
              value={weightLabel}
              onPress={openCurrentWeightSheet}
            />
            <WeightMetricCard
              hint={targetWeightDeltaHint}
              label={t('home.weight.targetTitle')}
              value={targetWeightLabel}
              onPress={openTargetWeightSheet}
            />
          </View>

          <TodayMealsSection
            meals={todayMeals}
            isLoading={isTodayMealsLoading}
            onMealPress={handleTodayMealPress}
          />
        </ScrollView>

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
        title={
          weightSheet === 'target'
            ? t('home.weight.updateTargetTitle')
            : t('home.weight.modalTitle')
        }
        subtitle={
          weightSheet === 'target'
            ? t('home.weight.updateTargetDescription')
            : t('home.weight.modalSubtitle')
        }
        unitSystem={unitSystem}
        value={weightDraft}
        isSaving={isSavingWeight}
        onChange={setWeightDraft}
        onClose={closeWeightSheet}
        onSave={() => void (weightSheet === 'target' ? saveTargetWeight() : saveCurrentWeight())}
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

const styles = StyleSheet.create({
  calorieHeroRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 16,
  },
  calorieHeroLeft: {
    flex: 1,
    minWidth: 0,
    justifyContent: 'flex-start',
  },
  calorieHeroLabel: {
    marginBottom: 4,
    fontSize: 14,
    fontWeight: '500',
    color: '#6B7280',
  },
  calorieHeroValue: {
    fontSize: 48,
    fontWeight: '700',
    lineHeight: 52,
  },
  calorieHeroGrid: {
    width: '52%',
    flexGrow: 0,
    flexShrink: 0,
  },
});
