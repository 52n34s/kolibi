import { Ionicons } from '@expo/vector-icons';
import { Href, router } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useQueryClient } from '@tanstack/react-query';

import { HomeLayout, useMeshScreenInsets } from '@/components/home/home-layout';
import { BarcodeScanButton } from '@/components/home/BarcodeScanButton';
import { HistoryKoliButton } from '@/components/home/history-koli-button';
import { ManualEntryButton } from '@/components/home/ManualEntryButton';
import { ScanMealButton } from '@/components/home/ScanMealButton';
import { BarcodeCameraView } from '@/components/scan/BarcodeCameraView';
import { BarcodeLookupErrorSheet } from '@/components/scan/BarcodeLookupErrorSheet';
import { BarcodeProductNotFoundSheet } from '@/components/scan/BarcodeProductNotFoundSheet';
import { BarcodeQuantitySheet } from '@/components/scan/BarcodeQuantitySheet';
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
import { GlassCard } from '@/components/ui/glass-card';
import { getGlassCardStyle } from '@/components/ui/glass-styles';
import { TodayMealsSection } from '@/components/home/TodayMealsSection';
import { useHomeDashboard } from '@/hooks/use-home-dashboard';
import { useTodayMeals } from '@/hooks/use-today-meals';
import { getTimeOfDay, getCalorieGoalDisplay, resolveDisplayName } from '@/lib/home';
import { kgToLbs } from '@/lib/units';
import {
  formatWeightForDisplay,
  parseWeightInputToKg,
  upsertTodayWeightLog,
} from '@/lib/weight-logs';
import { saveBarcodeMeal, saveScannedMeal, updateMealWithItems, type TodayMeal } from '@/lib/meals';
import { MEAL_SOURCE, type MealSource } from '@/lib/meal-sources';
import { pickMealPhotosFromGallery } from '@/lib/pick-meal-gallery';
import {
  BarcodeLookupAbortedError,
  BarcodeLookupError,
  BarcodeProductNotFoundError,
  fetchProductByBarcode,
  type BarcodeProduct,
} from '@/services/barcode/OpenFoodFactsService';
import {
  MealVisionApiError,
  MealVisionParseError,
  MealVisionRateLimitError,
  MealVisionService,
} from '@/services/mealVision/MealVisionService';
import type { EditableMealItem, VisionFoodItem } from '@/services/mealVision/types';
import { useAuthStore } from '@/stores/auth-store';
import { useOnboardingStore } from '@/stores/onboarding-store';

/** Dev-only: set e.g. 2269 to preview over-goal layout in the simulator */
const DEV_PREVIEW_CONSUMED_CALORIES = 0;

const CALORIE_GOAL_ACCENT = '#4F46E5';
const CALORIE_OVER_GOAL_COLOR = '#D97706';
const MAX_WEIGHT_KG = 699.9;

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
  const { t } = useTranslation();
  const { contentTopPadding } = useMeshScreenInsets();
  const queryClient = useQueryClient();
  const session = useAuthStore((state) => state.session);
  const userId = session?.user?.id;
  const unitSystem = useOnboardingStore((state) => state.unitSystem);
  const initializeUnitSystem = useOnboardingStore((state) => state.initializeUnitSystem);
  const { data, isLoading, isError, error } = useHomeDashboard();
  const { data: todayMeals, isLoading: isTodayMealsLoading } = useTodayMeals();

  const [showWeightModal, setShowWeightModal] = useState(false);
  const [weightDraft, setWeightDraft] = useState('');
  const [isSavingWeight, setIsSavingWeight] = useState(false);
  const [showScanOptions, setShowScanOptions] = useState(false);
  const [showCameraFlow, setShowCameraFlow] = useState(false);
  const [scanPhotoCount, setScanPhotoCount] = useState(1);
  const [isAnalyzingMeal, setIsAnalyzingMeal] = useState(false);
  const [showMealConfirmation, setShowMealConfirmation] = useState(false);
  const [visionItems, setVisionItems] = useState<VisionFoodItem[]>([]);
  const [isSavingMeal, setIsSavingMeal] = useState(false);
  const [showRateLimitSheet, setShowRateLimitSheet] = useState(false);
  const [rateLimitResetAt, setRateLimitResetAt] = useState<string | null>(null);
  const [showParseErrorSheet, setShowParseErrorSheet] = useState(false);
  const [showApiErrorSheet, setShowApiErrorSheet] = useState(false);
  const [pendingPhotoUris, setPendingPhotoUris] = useState<string[]>([]);
  const [pendingMealSource, setPendingMealSource] = useState<MealSource>(MEAL_SOURCE.PHOTO_CAMERA);
  const [isPickingGalleryPhotos, setIsPickingGalleryPhotos] = useState(false);
  const [showBarcodeCamera, setShowBarcodeCamera] = useState(false);
  const [isFetchingBarcodeProduct, setIsFetchingBarcodeProduct] = useState(false);
  const [barcodeProduct, setBarcodeProduct] = useState<BarcodeProduct | null>(null);
  const [showBarcodeQuantitySheet, setShowBarcodeQuantitySheet] = useState(false);
  const [showBarcodeNotFoundSheet, setShowBarcodeNotFoundSheet] = useState(false);
  const [showBarcodeLookupErrorSheet, setShowBarcodeLookupErrorSheet] = useState(false);
  const [pendingBarcode, setPendingBarcode] = useState<string | null>(null);
  const [isSavingBarcodeMeal, setIsSavingBarcodeMeal] = useState(false);
  const [showBarcodeLookupSlow, setShowBarcodeLookupSlow] = useState(false);
  const barcodeLookupAbortRef = useRef<AbortController | null>(null);
  const [showManualEntrySheet, setShowManualEntrySheet] = useState(false);
  const [isSavingManualMeal, setIsSavingManualMeal] = useState(false);
  const [editingMealId, setEditingMealId] = useState<string | null>(null);
  const [isSavingMealEdit, setIsSavingMealEdit] = useState(false);

  useEffect(() => {
    initializeUnitSystem();
  }, [initializeUnitSystem]);

  useEffect(() => {
    if (isError && error) {
      console.error('[Home] dashboard load failed:', error);
    }
  }, [error, isError]);

  useEffect(() => {
    if (!isFetchingBarcodeProduct) {
      setShowBarcodeLookupSlow(false);
      return;
    }

    const slowMessageTimer = setTimeout(() => {
      setShowBarcodeLookupSlow(true);
    }, 5_000);

    return () => clearTimeout(slowMessageTimer);
  }, [isFetchingBarcodeProduct]);

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

    return getCalorieGoalDisplay(dailyCalorieGoal, consumedCaloriesToday);
  }, [consumedCaloriesToday, dailyCalorieGoal, hasCalorieGoal]);

  const latestWeightKg = data?.latestWeight?.weight_kg ?? null;
  const weightLabel = useMemo(() => {
    if (latestWeightKg == null) {
      return t('home.weight.notLogged');
    }

    return formatWeightForDisplay({
      weightKg: latestWeightKg,
      unitSystem,
      kgLabel: t('onboarding.units.kg'),
      lbsLabel: t('onboarding.units.lbs'),
    });
  }, [latestWeightKg, t, unitSystem]);

  function openCalorieGoalSettings() {
    router.push('/koli/calorie-goal' as Href);
  }

  function openWeightModal() {
    if (latestWeightKg != null) {
      const initialValue =
        unitSystem === 'imperial' ? String(kgToLbs(latestWeightKg)) : String(latestWeightKg);
      setWeightDraft(initialValue);
    } else {
      setWeightDraft('');
    }

    setShowWeightModal(true);
  }

  async function saveWeight() {
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
      setShowWeightModal(false);
    } catch (saveError) {
      console.error('[Home] weight save failed:', saveError);
      Alert.alert(t('settings.errors.title'), t('home.weight.saveFailed'));
    } finally {
      setIsSavingWeight(false);
    }
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
        cancelLabel: t('settings.common.cancel'),
      });

      if (result.status === 'canceled' || result.status === 'permission_denied') {
        return;
      }

      setScanPhotoCount(photoCount);
      setPendingMealSource(MEAL_SOURCE.PHOTO_GALLERY);
      setShowScanOptions(false);
      setPendingPhotoUris(result.uris);
      await analyzeMealPhotos(result.uris);
    } finally {
      setIsPickingGalleryPhotos(false);
    }
  }

  async function analyzeMealPhotos(photoUris: string[]) {
    setIsAnalyzingMeal(true);

    try {
      const result = await MealVisionService.analyze(photoUris);
      setVisionItems(result.items);
      setShowMealConfirmation(true);
      setPendingPhotoUris([]);
      setShowParseErrorSheet(false);
      setShowApiErrorSheet(false);
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
    setShowCameraFlow(false);
    setPendingMealSource(MEAL_SOURCE.PHOTO_CAMERA);
    setPendingPhotoUris(photoUris);
    await analyzeMealPhotos(photoUris);
  }

  function handleParseErrorScanAgain() {
    setShowParseErrorSheet(false);
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

  async function handleMealSave(items: EditableMealItem[]) {
    if (!userId) {
      return;
    }

    setIsSavingMeal(true);

    try {
      await saveScannedMeal({
        userId,
        items,
        source: pendingMealSource,
      });
      await queryClient.invalidateQueries({ queryKey: ['home-dashboard', userId] });
      await queryClient.invalidateQueries({ queryKey: ['today-meals', userId] });
      await queryClient.invalidateQueries({ queryKey: ['history', userId] });
      handleMealConfirmationClose();
    } catch (saveError) {
      console.error('[Home] meal save failed:', saveError);
      Alert.alert(t('settings.errors.title'), t('home.scan.confirmation.saveError'));
    } finally {
      setIsSavingMeal(false);
    }
  }

  function handleBarcodePress() {
    setShowBarcodeCamera(true);
  }

  function handleBarcodeCameraCancel() {
    setShowBarcodeCamera(false);
  }

  function cancelBarcodeLookup() {
    barcodeLookupAbortRef.current?.abort();
    barcodeLookupAbortRef.current = null;
    setIsFetchingBarcodeProduct(false);
    setShowBarcodeLookupSlow(false);
    setPendingBarcode(null);
  }

  async function lookupBarcodeProduct(barcode: string) {
    barcodeLookupAbortRef.current?.abort();

    const controller = new AbortController();
    barcodeLookupAbortRef.current = controller;
    setIsFetchingBarcodeProduct(true);
    setShowBarcodeLookupSlow(false);

    try {
      const product = await fetchProductByBarcode(barcode, { signal: controller.signal });
      setBarcodeProduct(product);
      setShowBarcodeQuantitySheet(true);
      setPendingBarcode(null);
      setShowBarcodeLookupErrorSheet(false);
      setShowBarcodeNotFoundSheet(false);
    } catch (lookupError) {
      if (lookupError instanceof BarcodeLookupAbortedError) {
        return;
      }

      if (lookupError instanceof BarcodeProductNotFoundError) {
        setShowBarcodeNotFoundSheet(true);
        return;
      }

      if (lookupError instanceof BarcodeLookupError) {
        setShowBarcodeLookupErrorSheet(true);
        return;
      }

      setShowBarcodeLookupErrorSheet(true);
    } finally {
      if (barcodeLookupAbortRef.current === controller) {
        barcodeLookupAbortRef.current = null;
      }
      setIsFetchingBarcodeProduct(false);
      setShowBarcodeLookupSlow(false);
    }
  }

  async function handleBarcodeDetected(barcode: string) {
    setShowBarcodeCamera(false);
    setPendingBarcode(barcode);
    await lookupBarcodeProduct(barcode);
  }

  async function handleBarcodeLookupRetry() {
    if (!pendingBarcode) {
      setShowBarcodeLookupErrorSheet(false);
      return;
    }

    setShowBarcodeLookupErrorSheet(false);
    await lookupBarcodeProduct(pendingBarcode);
  }

  function handleBarcodeQuantityClose() {
    setShowBarcodeQuantitySheet(false);
    setBarcodeProduct(null);
  }

  function handleBarcodeNotFoundClose() {
    setShowBarcodeNotFoundSheet(false);
  }

  function handleBarcodeTakePhotoInstead() {
    setShowBarcodeNotFoundSheet(false);
    setScanPhotoCount(1);
    setPendingMealSource(MEAL_SOURCE.PHOTO_CAMERA);
    setShowCameraFlow(true);
  }

  async function handleBarcodeSave(params: { quantityGrams: number }) {
    if (!userId || !barcodeProduct) {
      return;
    }

    setIsSavingBarcodeMeal(true);

    try {
      await saveBarcodeMeal({
        userId,
        productName: barcodeProduct.productName,
        kcalPer100g: barcodeProduct.kcalPer100g,
        proteinPer100g: barcodeProduct.proteinPer100g,
        carbsPer100g: barcodeProduct.carbsPer100g,
        fatPer100g: barcodeProduct.fatPer100g,
        quantityGrams: params.quantityGrams,
      });
      await queryClient.invalidateQueries({ queryKey: ['home-dashboard', userId] });
      await queryClient.invalidateQueries({ queryKey: ['today-meals', userId] });
      await queryClient.invalidateQueries({ queryKey: ['history', userId] });
      handleBarcodeQuantityClose();
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
      await saveScannedMeal({
        userId,
        items,
        source: MEAL_SOURCE.MANUAL,
      });
      await queryClient.invalidateQueries({ queryKey: ['home-dashboard', userId] });
      await queryClient.invalidateQueries({ queryKey: ['today-meals', userId] });
      await queryClient.invalidateQueries({ queryKey: ['history', userId] });
      setShowManualEntrySheet(false);
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
  }) {
    if (!userId) {
      return;
    }

    setIsSavingMealEdit(true);

    try {
      await updateMealWithItems({
        mealId: params.mealId,
        userId,
        items: params.items,
        removedMealItemIds: params.removedMealItemIds,
      });
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
    <HomeLayout>
      <View className="absolute right-6 z-10" style={{ top: contentTopPadding }}>
        <HistoryKoliButton accessibilityLabel={t('koli.title')} />
      </View>
      <View className="flex-1">
        <ScrollView
          className="flex-1 px-6"
          contentContainerStyle={{ paddingTop: contentTopPadding, paddingBottom: 120 }}
          showsVerticalScrollIndicator={false}>
          <Text className="mb-6 pr-12 text-2xl font-bold text-gray-900">{greeting}</Text>

          {calorieGoalDisplay ? (
            <View style={[getOnboardingIdleCardStyle(), { borderRadius: ONBOARDING_CARD_RADIUS }]}>
              <View className="px-5 py-6">
                <Text className="mb-2 text-sm font-medium text-gray-500">
                  {t('home.calorieGoal.label')}
                </Text>
                <Text
                  className="text-5xl font-bold"
                  style={{
                    color: calorieGoalDisplay.isOverGoal
                      ? CALORIE_OVER_GOAL_COLOR
                      : CALORIE_GOAL_ACCENT,
                  }}>
                  {calorieGoalDisplay.mainValue}
                </Text>
                {calorieGoalDisplay.showOverLabel ? (
                  <Text className="mt-2 text-base font-medium text-amber-700">
                    {t('home.calorieGoal.overGoal')}
                  </Text>
                ) : null}
                <Text
                  className={`text-sm text-gray-500 ${calorieGoalDisplay.showOverLabel ? 'mt-1' : 'mt-2'}`}>
                  {t('home.calorieGoal.dailyGoalReference', {
                    goal: calorieGoalDisplay.dailyGoalContextValue,
                  })}
                </Text>
              </View>
            </View>
          ) : (
            <Pressable
              onPress={openCalorieGoalSettings}
              style={({ pressed }) => [
                getOnboardingSecondarySurfaceStyle(),
                { opacity: pressed ? 0.75 : 1 },
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
          )}

          <Pressable
            className="mt-4"
            onPress={openWeightModal}
            style={({ pressed }) => [
              getOnboardingSecondarySurfaceStyle(),
              { opacity: pressed ? 0.75 : 1, borderRadius: ONBOARDING_CARD_RADIUS },
            ]}>
            <View className="flex-row items-center px-4 py-4">
              <View className="mr-3 h-10 w-10 items-center justify-center rounded-full bg-[#EEF2FF]">
                <Ionicons name="scale-outline" size={20} color={ONBOARDING_ACCENT} />
              </View>
              <View className="flex-1">
                <Text className="text-sm font-medium text-gray-500">{t('home.weight.label')}</Text>
                <Text className="mt-1 text-lg font-semibold text-gray-900">{weightLabel}</Text>
              </View>
              <Ionicons name="create-outline" size={18} color="#9CA3AF" />
            </View>
          </Pressable>

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
                onPress={() => setShowManualEntrySheet(true)}
              />
              <Text className="mt-3 text-sm font-medium text-gray-600">
                {t('home.manualEntry.buttonLabel')}
              </Text>
            </View>

            <View className="items-center">
              <ScanMealButton
                accessibilityLabel={t('home.scan.buttonLabel')}
                onPress={() => setShowScanOptions(true)}
              />
              <Text className="mt-3 text-sm font-medium text-gray-600">
                {t('home.scan.buttonLabel')}
              </Text>
            </View>

            <View className="items-center">
              <BarcodeScanButton
                accessibilityLabel={t('home.scan.barcodeLabel')}
                onPress={handleBarcodePress}
              />
              <Text className="mt-3 text-sm font-medium text-gray-600">
                {t('home.scan.barcodeLabel')}
              </Text>
            </View>
          </View>
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
        onSave={(items) => void handleMealSave(items)}
      />

      <ScanRateLimitSheet
        visible={showRateLimitSheet}
        resetAt={rateLimitResetAt}
        onClose={() => setShowRateLimitSheet(false)}
      />

      <ScanParseErrorSheet
        visible={showParseErrorSheet}
        onClose={() => setShowParseErrorSheet(false)}
        onScanAgain={handleParseErrorScanAgain}
        onManualEntry={handleParseErrorManualEntry}
      />

      <ScanApiErrorSheet
        visible={showApiErrorSheet}
        onClose={() => setShowApiErrorSheet(false)}
        onRetry={() => void handleApiErrorRetry()}
      />

      <BarcodeCameraView
        visible={showBarcodeCamera}
        onCancel={handleBarcodeCameraCancel}
        onBarcodeScanned={(barcode) => void handleBarcodeDetected(barcode)}
      />

      <BarcodeQuantitySheet
        visible={showBarcodeQuantitySheet}
        product={barcodeProduct}
        isSaving={isSavingBarcodeMeal}
        onClose={handleBarcodeQuantityClose}
        onSave={(params) => void handleBarcodeSave(params)}
      />

      <BarcodeProductNotFoundSheet
        visible={showBarcodeNotFoundSheet}
        onClose={handleBarcodeNotFoundClose}
        onTakePhotoInstead={handleBarcodeTakePhotoInstead}
      />

      <BarcodeLookupErrorSheet
        visible={showBarcodeLookupErrorSheet}
        onClose={() => setShowBarcodeLookupErrorSheet(false)}
        onRetry={() => void handleBarcodeLookupRetry()}
      />

      <ManualMealEntrySheet
        visible={showManualEntrySheet}
        isSaving={isSavingManualMeal}
        onClose={() => setShowManualEntrySheet(false)}
        onSave={(items) => void handleManualMealSave(items)}
      />

      <MealEditSheet
        visible={editingMealId != null}
        mealId={editingMealId}
        userId={userId ?? null}
        isSaving={isSavingMealEdit}
        onClose={handleMealEditClose}
        onSave={(params) => void handleMealEditSave(params)}
      />

      <Modal
        transparent
        visible={isFetchingBarcodeProduct}
        animationType="fade"
        onRequestClose={cancelBarcodeLookup}>
        <View className="flex-1 items-center justify-center bg-black/55 px-6">
          <ActivityIndicator size="large" color="#FFFFFF" />
          <Text className="mt-4 text-center text-base font-medium text-white">
            {t('home.scan.barcode.loadingProduct')}
          </Text>
          {showBarcodeLookupSlow ? (
            <Text className="mt-2 text-center text-sm text-white/80">
              {t('home.scan.barcode.loadingSlow')}
            </Text>
          ) : null}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('settings.common.cancel')}
            className="mt-6 rounded-xl bg-white/20 px-5 py-3"
            onPress={cancelBarcodeLookup}>
            <Text className="text-base font-semibold text-white">{t('settings.common.cancel')}</Text>
          </Pressable>
        </View>
      </Modal>

      <Modal
        transparent
        visible={isAnalyzingMeal}
        animationType="fade"
        onRequestClose={() => undefined}>
        <View className="flex-1 items-center justify-center bg-black/55 px-6">
          <ActivityIndicator size="large" color="#FFFFFF" />
          <Text className="mt-4 text-center text-base font-medium text-white">
            {t('home.scan.confirmation.analyzing')}
          </Text>
        </View>
      </Modal>

      <Modal
        transparent
        visible={showWeightModal}
        animationType="fade"
        onRequestClose={() => setShowWeightModal(false)}>
        <Pressable
          className="flex-1 justify-center bg-black/40 px-6"
          onPress={() => setShowWeightModal(false)}>
          <Pressable onPress={(event) => event.stopPropagation()}>
            <GlassCard className="p-5">
            <Text className="mb-2 text-lg font-semibold text-gray-900">{t('home.weight.modalTitle')}</Text>
            <Text className="mb-4 text-sm text-gray-500">{t('home.weight.modalSubtitle')}</Text>
            <TextInput
              autoFocus
              keyboardType="decimal-pad"
              placeholder={
                unitSystem === 'imperial'
                  ? t('home.weight.placeholderLbs')
                  : t('home.weight.placeholderKg')
              }
              value={weightDraft}
              onChangeText={setWeightDraft}
              className="mb-4 h-11 px-3 text-base text-gray-900"
              style={getGlassCardStyle({ borderRadius: 12, height: 44 })}
            />
            <View className="flex-row justify-end gap-3">
              <Pressable className="px-3 py-2" onPress={() => setShowWeightModal(false)}>
                <Text className="text-base text-gray-500">{t('settings.common.cancel')}</Text>
              </Pressable>
              <Pressable
                className="rounded-lg bg-[#4F46E5] px-4 py-2"
                disabled={isSavingWeight}
                onPress={() => void saveWeight()}>
                {isSavingWeight ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text className="text-base font-semibold text-white">{t('settings.common.save')}</Text>
                )}
              </Pressable>
            </View>
            </GlassCard>
          </Pressable>
        </Pressable>
      </Modal>
    </HomeLayout>
  );
}
