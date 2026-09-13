import { LinearGradient } from 'expo-linear-gradient';
import { type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';

import { BarcodeCameraView } from '@/components/scan/BarcodeCameraView';
import { ProductIdentityCard } from '@/components/scan/ProductIdentityCard';
import { ProductNutritionPanel } from '@/components/scan/ProductNutritionPanel';
import { GlassSheetSurface } from '@/components/shared/GlassSheetSurface';
import type { BarcodeProduct } from '@/services/barcode/OpenFoodFactsService';

export type ProductLookupState =
  | { kind: 'closed' }
  | { kind: 'camera' }
  | { kind: 'loading' }
  | { kind: 'result'; product: BarcodeProduct }
  | { kind: 'notFound' }
  | { kind: 'lookupError' };

type ProductLookupModalProps = {
  state: ProductLookupState;
  onClose: () => void;
  onBarcodeScanned: (barcode: string) => void;
  onScanAnother: () => void;
};

function SheetLayout({ children, onClose }: { children: ReactNode; onClose: () => void }) {
  const { height } = useWindowDimensions();
  const maxHeight = height * 0.88;
  return <View style={styles.overlay}>
    <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
    <Pressable style={[styles.sheetShell, { maxHeight }]} onPress={(event) => event.stopPropagation()}>
      <GlassSheetSurface maxHeight={maxHeight}>{children}</GlassSheetSurface>
    </Pressable>
  </View>;
}

function ScanAnotherButton({ onPress }: { onPress: () => void }) {
  const { t } = useTranslation();
  const label = t('home.productLookup.scanAnother');
  return <Pressable accessibilityRole="button" accessibilityLabel={label} style={styles.buttonShell} onPress={onPress}>
    <LinearGradient colors={['#4F46E5', '#7CE7C7']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.buttonGradient}>
      <Text style={styles.buttonLabel}>{label}</Text>
    </LinearGradient>
  </Pressable>;
}

function ErrorContent({ title, message, onScanAnother }: { title: string; message: string; onScanAnother: () => void }) {
  return <View style={styles.errorContent}>
    <Text style={styles.errorTitle}>{title}</Text>
    <Text style={styles.errorMessage}>{message}</Text>
    <ScanAnotherButton onPress={onScanAnother} />
  </View>;
}

export function ProductLookupModal({ state, onClose, onBarcodeScanned, onScanAnother }: ProductLookupModalProps) {
  const { t } = useTranslation();
  const isOpen = state.kind !== 'closed';
  let content: ReactNode = null;
  if (state.kind === 'camera') content = <BarcodeCameraView onCancel={onClose} onBarcodeScanned={onBarcodeScanned} />;
  if (state.kind === 'loading') content = <View style={styles.loading}><ActivityIndicator size="large" color="#FFFFFF" /></View>;
  if (state.kind === 'result') content = <SheetLayout onClose={onClose}><ScrollView contentContainerStyle={styles.resultContent} showsVerticalScrollIndicator={false}><ProductIdentityCard product={state.product} /><ProductNutritionPanel product={state.product} /><ScanAnotherButton onPress={onScanAnother} /></ScrollView></SheetLayout>;
  if (state.kind === 'notFound') content = <SheetLayout onClose={onClose}><ErrorContent title={t('home.productLookup.notFoundTitle')} message={t('home.productLookup.notFoundMessage')} onScanAnother={onScanAnother} /></SheetLayout>;
  if (state.kind === 'lookupError') content = <SheetLayout onClose={onClose}><ErrorContent title={t('home.productLookup.errorTitle')} message={t('home.productLookup.errorMessage')} onScanAnother={onScanAnother} /></SheetLayout>;
  return <Modal visible={isOpen} animationType="none" onRequestClose={onClose} transparent>{isOpen ? content : null}</Modal>;
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end' },
  sheetShell: { width: '100%' },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0, 0, 0, 0.55)' },
  resultContent: { paddingVertical: 8, gap: 12 },
  errorContent: { paddingVertical: 8 },
  errorTitle: { marginBottom: 12, fontSize: 18, fontWeight: '600', color: '#111827', textAlign: 'center' },
  errorMessage: { marginBottom: 20, fontSize: 15, lineHeight: 22, color: '#4B5563', textAlign: 'center' },
  buttonShell: { height: 48, borderRadius: 12, overflow: 'hidden' },
  buttonGradient: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  buttonLabel: { fontSize: 16, fontWeight: '600', color: '#FFFFFF' },
});
