import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';

import {
  ONBOARDING_ACCENT,
  ONBOARDING_CARD_COLORS,
  ONBOARDING_SECONDARY_SURFACE,
} from '@/components/onboarding/onboarding-styles';
import { BarcodeCameraView } from '@/components/scan/BarcodeCameraView';
import {
  getAvailableQuantityOptions,
  getDefaultCustomGrams,
  getDefaultOption,
  getQuantityGramsForOption,
  type QuantityOption,
} from '@/components/scan/barcode-quantity-utils';
import { MealItemRow } from '@/components/scan/MealItemRow';
import {
  changeRowItemKcal,
  changeRowItemName,
  changeRowItemQuantity,
  changeRowItemUnit,
  createEmptyRowItem,
  createRowItemFromBarcode,
  isRowItemValid,
  sumRowItemsKcal,
  type MealItemRowItem,
} from '@/components/scan/meal-item-row-model';
import { mealEntrySheetStyles } from '@/components/scan/meal-entry-shared';
import { MealItemsSheetBody } from '@/components/scan/MealItemsSheetBody';
import { MealInputFloatingBar } from '@/components/scan/MealInputAccessoryBar';
import { MealInputBarProvider } from '@/components/scan/meal-input-bar-context';
import { GlassSheetSurface } from '@/components/shared/GlassSheetSurface';
import type { BarcodeProduct } from '@/services/barcode/OpenFoodFactsService';

export type BarcodeFlowState =
  | { kind: 'closed' }
  | { kind: 'camera' }
  | { kind: 'loading' }
  | { kind: 'quantity'; product: BarcodeProduct }
  | { kind: 'notFound' }
  | { kind: 'nutrimentsMissing' }
  | { kind: 'lookupError' };

type BarcodeFlowModalProps = {
  state: BarcodeFlowState;
  isSaving: boolean;
  showLookupSlow: boolean;
  onClose: () => void;
  onDismissed?: () => void;
  onBarcodeScanned: (barcode: string) => void;
  onSaveItems: (items: MealItemRowItem[]) => void;
  onRetryLookup: () => void;
  onTakePhotoInstead: () => void;
};

const DEFAULT_CUSTOM_GRAMS = 100;

function BarcodeQuantityContent({
  product,
  isSaving,
  onSave,
}: {
  product: BarcodeProduct;
  isSaving: boolean;
  onSave: (items: MealItemRowItem[]) => void;
}) {
  const { t } = useTranslation();
  const [selectedOption, setSelectedOption] = useState<QuantityOption>('custom');
  const [rowItems, setRowItems] = useState<MealItemRowItem[]>([]);

  useEffect(() => {
    const option = getDefaultOption(product);
    const customGrams = getDefaultCustomGrams(product, DEFAULT_CUSTOM_GRAMS);
    const quantityGrams = getQuantityGramsForOption(option, product, customGrams);
    setSelectedOption(option);
    setRowItems([createRowItemFromBarcode(product, quantityGrams)]);
  }, [product]);

  const availableOptions = useMemo(() => getAvailableQuantityOptions(product), [product]);
  const totalKcal = useMemo(() => sumRowItemsKcal(rowItems), [rowItems]);
  const canSave = useMemo(
    () => rowItems.length > 0 && rowItems.every((item) => isRowItemValid(item)),
    [rowItems],
  );

  function updateRowItem(id: string, updater: (item: MealItemRowItem) => MealItemRowItem) {
    setRowItems((current) =>
      current.map((item) => (item.id === id ? updater(item) : item)),
    );
  }

  function applyPresetOption(option: QuantityOption) {
    setSelectedOption(option);
    const customGrams = rowItems[0]?.quantity ?? DEFAULT_CUSTOM_GRAMS;
    const quantityGrams = getQuantityGramsForOption(option, product, customGrams);

    setRowItems((current) => {
      if (current.length === 0) {
        return [createRowItemFromBarcode(product, quantityGrams)];
      }

      const [first, ...rest] = current;
      return [
        changeRowItemQuantity(
          {
            ...first,
            name: product.productName,
            kcalPer100g: product.kcalPer100g,
            unit: 'g',
            gramsPerUnit: product.servingSizeGrams,
          },
          quantityGrams,
        ),
        ...rest,
      ];
    });
  }

  function handleRowQuantityChange(id: string, value: number) {
    setSelectedOption('custom');
    updateRowItem(id, (row) => changeRowItemQuantity(row, value));
  }

  function handleAddProduct() {
    setRowItems((current) => [...current, createEmptyRowItem()]);
  }

  function handleSavePress() {
    if (!canSave) {
      return;
    }

    onSave(rowItems);
  }

  const optionLabels: Record<QuantityOption, string> = {
    whole: t('home.scan.barcode.quantity.wholePackage'),
    half: t('home.scan.barcode.quantity.halfPackage'),
    serving: t('home.scan.barcode.quantity.oneServing'),
    custom: t('home.scan.barcode.quantity.customAmount'),
  };

  return (
    <MealItemsSheetBody
      header={
        <>
          <Text style={mealEntrySheetStyles.totalKcal}>{totalKcal}</Text>
          <Text style={mealEntrySheetStyles.totalLabel}>{t('home.scan.confirmation.totalKcal')}</Text>

          <View style={quantityStyles.pillWrap}>
            {availableOptions.map((option) => {
              const isActive = selectedOption === option;

              return (
                <Pressable
                  key={option}
                  accessibilityRole="button"
                  accessibilityLabel={optionLabels[option]}
                  style={[quantityStyles.pill, isActive && quantityStyles.pillActive]}
                  onPress={() => applyPresetOption(option)}>
                  <Text style={[quantityStyles.pillLabel, isActive && quantityStyles.pillLabelActive]}>
                    {optionLabels[option]}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </>
      }
      footer={
        <>
          {!canSave ? (
            <Text style={mealEntrySheetStyles.saveHint}>{t('home.manualEntry.validationFixRows')}</Text>
          ) : null}

          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('home.manualEntry.addProduct')}
            style={mealEntrySheetStyles.addButton}
            onPress={handleAddProduct}>
            <Ionicons name="add-circle-outline" size={18} color="#4F46E5" />
            <Text style={mealEntrySheetStyles.addButtonLabel}>{t('home.manualEntry.addProduct')}</Text>
          </Pressable>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('home.scan.confirmation.save')}
            disabled={isSaving || !canSave}
            style={[
              mealEntrySheetStyles.saveShell,
              (isSaving || !canSave) && mealEntrySheetStyles.saveDisabled,
            ]}
            onPress={handleSavePress}>
            <LinearGradient
              colors={['#4F46E5', '#7CE7C7']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={mealEntrySheetStyles.saveGradient}>
              {isSaving ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={mealEntrySheetStyles.saveLabel}>{t('home.scan.confirmation.save')}</Text>
              )}
            </LinearGradient>
          </Pressable>
        </>
      }>
      {rowItems.map((item) => (
        <MealItemRow
          key={item.id}
          invalid={!isRowItemValid(item)}
          item={item}
          onChangeKcal={(id, value) => updateRowItem(id, (row) => changeRowItemKcal(row, value))}
          onChangeName={(id, name) => updateRowItem(id, (row) => changeRowItemName(row, name))}
          onChangeQuantity={handleRowQuantityChange}
          onChangeUnit={(id, unit) => {
            setSelectedOption('custom');
            updateRowItem(id, (row) => changeRowItemUnit(row, unit));
          }}
          onRemove={rowItems.length > 1 ? (id) => setRowItems((c) => c.filter((r) => r.id !== id)) : undefined}
        />
      ))}
    </MealItemsSheetBody>
  );
}

function BarcodeSheetLayout({
  children,
  onClose,
}: {
  children: ReactNode;
  onClose: () => void;
}) {
  const { height: windowHeight } = useWindowDimensions();
  const maxSheetHeight = windowHeight * 0.88;

  return (
    <View style={sheetStyles.overlay}>
      <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
      <Pressable
        style={[sheetStyles.sheetShell, { maxHeight: maxSheetHeight }]}
        onPress={(event) => event.stopPropagation()}>
        <GlassSheetSurface maxHeight={maxSheetHeight}>{children}</GlassSheetSurface>
      </Pressable>
    </View>
  );
}

function BarcodeLoadingContent({
  showLookupSlow,
  onCancel,
}: {
  showLookupSlow: boolean;
  onCancel: () => void;
}) {
  const { t } = useTranslation();

  return (
    <View style={loadingStyles.container}>
      <ActivityIndicator size="large" color="#FFFFFF" />
      <Text style={loadingStyles.title}>{t('home.scan.barcode.loadingProduct')}</Text>
      {showLookupSlow ? (
        <Text style={loadingStyles.slowMessage}>{t('home.scan.barcode.loadingSlow')}</Text>
      ) : null}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('settings.common.cancel')}
        style={loadingStyles.cancelButton}
        onPress={onCancel}>
        <Text style={loadingStyles.cancelLabel}>{t('settings.common.cancel')}</Text>
      </Pressable>
    </View>
  );
}

function BarcodeErrorSheetContent({
  title,
  message,
  actionLabel,
  onAction,
}: {
  title: string;
  message: string;
  actionLabel: string;
  onAction: () => void;
}) {
  return (
    <>
      <Text style={errorStyles.title}>{title}</Text>
      <Text style={errorStyles.message}>{message}</Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={actionLabel}
        style={errorStyles.buttonShell}
        onPress={onAction}>
        <LinearGradient
          colors={['#4F46E5', '#7CE7C7']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={errorStyles.buttonGradient}>
          <Text style={errorStyles.buttonLabel}>{actionLabel}</Text>
        </LinearGradient>
      </Pressable>
    </>
  );
}

export function BarcodeFlowModal({
  state,
  isSaving,
  showLookupSlow,
  onClose,
  onDismissed,
  onBarcodeScanned,
  onSaveItems,
  onRetryLookup,
  onTakePhotoInstead,
}: BarcodeFlowModalProps) {
  const { t } = useTranslation();
  const isOpen = state.kind !== 'closed';

  function renderContent() {
    switch (state.kind) {
      case 'closed':
        return null;

      case 'camera':
        return (
          <BarcodeCameraView onCancel={onClose} onBarcodeScanned={onBarcodeScanned} />
        );

      case 'loading':
        return <BarcodeLoadingContent showLookupSlow={showLookupSlow} onCancel={onClose} />;

      case 'quantity':
        return (
          <BarcodeSheetLayout onClose={onClose}>
            <BarcodeQuantityContent
              product={state.product}
              isSaving={isSaving}
              onSave={onSaveItems}
            />
          </BarcodeSheetLayout>
        );

      case 'notFound':
        return (
          <BarcodeSheetLayout onClose={onClose}>
            <BarcodeErrorSheetContent
              title={t('home.scan.barcode.notFoundTitle')}
              message={t('home.scan.barcode.notFoundMessage')}
              actionLabel={t('home.scan.barcode.takePhotoInstead')}
              onAction={onTakePhotoInstead}
            />
          </BarcodeSheetLayout>
        );

      case 'nutrimentsMissing':
        return (
          <BarcodeSheetLayout onClose={onClose}>
            <BarcodeErrorSheetContent
              title={t('home.scan.barcode.nutrimentsMissingTitle')}
              message={t('home.scan.barcode.nutrimentsMissingMessage')}
              actionLabel={t('home.scan.barcode.takePhotoOfLabel')}
              onAction={onTakePhotoInstead}
            />
          </BarcodeSheetLayout>
        );

      case 'lookupError':
        return (
          <BarcodeSheetLayout onClose={onClose}>
            <BarcodeErrorSheetContent
              title={t('home.scan.errors.apiTitle')}
              message={t('home.scan.errors.apiMessage')}
              actionLabel={t('home.scan.errors.retryAnalysis')}
              onAction={onRetryLookup}
            />
          </BarcodeSheetLayout>
        );
    }
  }

  return (
    <Modal
      visible={isOpen}
      animationType="none"
      onRequestClose={onClose}
      onDismiss={onDismissed}
      transparent>
      {isOpen ? (
        <MealInputBarProvider>
          <View style={state.kind === 'camera' ? styles.cameraRoot : styles.overlayRoot}>
            {renderContent()}
            <MealInputFloatingBar />
          </View>
        </MealInputBarProvider>
      ) : null}
    </Modal>
  );
}

const styles = StyleSheet.create({
  cameraRoot: {
    flex: 1,
    backgroundColor: '#000000',
  },
  overlayRoot: {
    flex: 1,
    position: 'relative',
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
  },
});

const sheetStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  sheetShell: {
    width: '100%',
  },
});

const loadingStyles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  title: {
    marginTop: 16,
    fontSize: 16,
    fontWeight: '500',
    color: '#FFFFFF',
    textAlign: 'center',
  },
  slowMessage: {
    marginTop: 8,
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.8)',
    textAlign: 'center',
  },
  cancelButton: {
    marginTop: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  cancelLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});

const errorStyles = StyleSheet.create({
  title: {
    marginBottom: 12,
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
    textAlign: 'center',
  },
  message: {
    marginBottom: 20,
    fontSize: 15,
    lineHeight: 22,
    color: '#4B5563',
    textAlign: 'center',
  },
  buttonShell: {
    height: 48,
    borderRadius: 12,
    overflow: 'hidden',
  },
  buttonGradient: {
    flex: 1,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});

const quantityStyles = StyleSheet.create({
  productName: {
    marginBottom: 12,
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
    textAlign: 'center',
  },
  totalKcal: {
    fontSize: 44,
    fontWeight: '700',
    color: '#4F46E5',
    textAlign: 'center',
  },
  totalLabel: {
    marginBottom: 16,
    fontSize: 14,
    fontWeight: '500',
    color: '#6B7280',
    textAlign: 'center',
  },
  pillWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 16,
    padding: 4,
    borderRadius: ONBOARDING_SECONDARY_SURFACE.borderRadius,
    backgroundColor: 'rgba(255, 255, 255, 0.45)',
    borderWidth: 1,
    borderColor: ONBOARDING_CARD_COLORS.border,
  },
  pill: {
    borderRadius: ONBOARDING_SECONDARY_SURFACE.borderRadius - 4,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: 'transparent',
  },
  pillActive: {
    backgroundColor: ONBOARDING_ACCENT,
  },
  pillLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6B7280',
  },
  pillLabelActive: {
    color: '#FFFFFF',
  },
  customRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.55)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.85)',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  customLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111827',
  },
  selectedQuantity: {
    marginBottom: 16,
    fontSize: 15,
    fontWeight: '500',
    color: '#6B7280',
    textAlign: 'center',
  },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  stepperButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(79, 70, 229, 0.1)',
  },
  saveShell: {
    height: 48,
    borderRadius: 12,
    overflow: 'hidden',
  },
  saveDisabled: {
    opacity: 0.6,
  },
  saveGradient: {
    flex: 1,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});
