import { Ionicons } from '@expo/vector-icons';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';

import { GlassSheetSurface } from '@/components/shared/GlassSheetSurface';
import { GLASS_SURFACE } from '@/components/ui/glass-styles';
import { TEXT_SECONDARY } from '@/constants/brand';
import { useHealthConnectedPreference } from '@/hooks/use-health-connected-preference';
import { useKeyboardHeight } from '@/hooks/use-keyboard-height';
import { useRequirePlan } from '@/hooks/use-require-plan';
import { useUnitSystem } from '@/hooks/use-unit-system';
import { fetchBodyMeasurementForDay, saveBodyMeasurement } from '@/lib/body-measurements';
import {
  MEASUREMENT_FIELDS,
  measurementCmToDraft,
  parseMeasurementInputToCm,
  type MeasurementField,
} from '@/lib/body-measurements-core';
import { localDateKey, parseDateOnly } from '@/lib/day-window';
import { saveWaistCircumferenceToHealth } from '@/lib/health';
import {
  NUMERIC_DONE_INPUT_PROPS,
  isPartialNumericInput,
  resolveNumericKeyboardType,
} from '@/lib/numeric-input';
import { deleteWaistLogForDay, fetchWaistCmForDay, upsertWaistLog } from '@/lib/waist-logs';
import { useAuthStore } from '@/stores/auth-store';

type Drafts = Record<MeasurementField, string>;
type Initial = Record<MeasurementField, number | null>;

const EMPTY_DRAFTS: Drafts = { chest: '', arm: '', waist: '', hip: '', thigh: '' };
const EMPTY_INITIAL: Initial = { chest: null, arm: null, waist: null, hip: null, thigh: null };
const CORE_FIELDS: readonly MeasurementField[] = ['chest', 'arm', 'waist'];
const MORE_FIELDS: readonly MeasurementField[] = ['hip', 'thigh'];

export type MeasurementsSheetProps = {
  visible: boolean;
  onClose: () => void;
};

/**
 * "Maße": chest, upper arm, waist, optional hip and thigh for today. The waist
 * is written to waist_logs (and Apple Health), the rest to body_measurements.
 */
export function MeasurementsSheet({ visible, onClose }: MeasurementsSheetProps) {
  const { t } = useTranslation();
  const { height: windowHeight } = useWindowDimensions();
  const keyboardHeight = useKeyboardHeight();
  const queryClient = useQueryClient();
  const requirePlan = useRequirePlan();
  const unitSystem = useUnitSystem();
  const userId = useAuthStore((state) => state.session?.user?.id);
  const { data: healthConnected = false } = useHealthConnectedPreference(userId);
  const [drafts, setDrafts] = useState<Drafts>(EMPTY_DRAFTS);
  const [initial, setInitial] = useState<Initial>(EMPTY_INITIAL);
  const [showMore, setShowMore] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const loadRef = useRef(0);
  const maxSheetHeight = windowHeight * 0.88;
  const unitLabel = unitSystem === 'imperial' ? t('measurements.units.in') : t('measurements.units.cm');

  useEffect(() => {
    if (!visible || !userId) {
      return;
    }
    const requestId = ++loadRef.current;
    setDrafts(EMPTY_DRAFTS);
    setInitial(EMPTY_INITIAL);
    setShowMore(false);
    const todayKey = localDateKey();
    void Promise.all([fetchBodyMeasurementForDay(userId, todayKey), fetchWaistCmForDay(userId, todayKey)])
      .then(([row, waistCm]) => {
        if (requestId !== loadRef.current) {
          return;
        }
        const loaded: Initial = {
          chest: row?.chest_cm ?? null,
          arm: row?.arm_cm ?? null,
          waist: waistCm,
          hip: row?.hip_cm ?? null,
          thigh: row?.thigh_cm ?? null,
        };
        setInitial(loaded);
        setDrafts({
          chest: measurementCmToDraft(loaded.chest, unitSystem),
          arm: measurementCmToDraft(loaded.arm, unitSystem),
          waist: measurementCmToDraft(loaded.waist, unitSystem),
          hip: measurementCmToDraft(loaded.hip, unitSystem),
          thigh: measurementCmToDraft(loaded.thigh, unitSystem),
        });
        setShowMore(loaded.hip != null || loaded.thigh != null);
      })
      .catch((error: unknown) => {
        console.error('[Measurements] load failed:', error);
      });
  }, [unitSystem, userId, visible]);

  function close() {
    loadRef.current += 1;
    onClose();
  }

  async function save() {
    if (!userId || isSaving) {
      return;
    }

    const parsed = {} as Record<MeasurementField, number | null>;
    for (const field of MEASUREMENT_FIELDS) {
      const result = parseMeasurementInputToCm({ field, value: drafts[field], unitSystem });
      if (!result.ok) {
        Alert.alert(
          t('settings.errors.title'),
          t('measurements.invalid', { field: t(`measurements.fields.${field}`) }),
        );
        return;
      }
      parsed[field] = result.cm;
    }

    const bodyChanged = (['chest', 'arm', 'hip', 'thigh'] as const).some(
      (field) => parsed[field] !== initial[field],
    );
    const waistChanged = parsed.waist !== initial.waist;
    if (!bodyChanged && !waistChanged) {
      close();
      return;
    }

    // A new entry: registered users without a plan see the paywall (same rule as weight).
    if (!(await requirePlan('enterWeight'))) {
      return;
    }

    setIsSaving(true);
    const todayKey = localDateKey();
    try {
      if (bodyChanged) {
        await saveBodyMeasurement({
          userId,
          measuredOn: todayKey,
          values: {
            chest_cm: parsed.chest,
            arm_cm: parsed.arm,
            hip_cm: parsed.hip,
            thigh_cm: parsed.thigh,
          },
        });
      }
      if (waistChanged) {
        if (parsed.waist != null) {
          await upsertWaistLog({ userId, waistCm: parsed.waist, loggedOn: todayKey });
          if (healthConnected) {
            try {
              const measuredAt = parseDateOnly(todayKey);
              measuredAt.setHours(12, 0, 0, 0);
              await saveWaistCircumferenceToHealth(parsed.waist, measuredAt);
            } catch (healthError) {
              console.error('[Measurements] waist HealthKit save failed:', healthError);
            }
          }
        } else {
          await deleteWaistLogForDay(userId, todayKey);
        }
      }
      await queryClient.invalidateQueries({ queryKey: ['history', userId] });
      await queryClient.invalidateQueries({ queryKey: ['home-dashboard', userId] });
      close();
    } catch (error) {
      console.error('[Measurements] save failed:', error);
      Alert.alert(t('settings.errors.title'), t('measurements.saveFailed'));
    } finally {
      setIsSaving(false);
    }
  }

  function renderField(field: MeasurementField) {
    const hint = field === 'chest' || field === 'arm' || field === 'waist'
      ? t(`measurements.fieldHints.${field}`)
      : null;
    return (
      <View key={field} style={styles.field}>
        <Text style={styles.label}>{t(`measurements.fields.${field}`)}</Text>
        <View style={styles.inputRow}>
          <TextInput
            accessibilityLabel={t(`measurements.fields.${field}`)}
            keyboardType={resolveNumericKeyboardType('decimal-pad')}
            placeholder={unitLabel}
            placeholderTextColor={TEXT_SECONDARY}
            style={styles.input}
            value={drafts[field]}
            onChangeText={(text) => {
              if (!isPartialNumericInput(text, true)) {
                return;
              }
              setDrafts((prev) => ({ ...prev, [field]: text }));
            }}
            {...NUMERIC_DONE_INPUT_PROPS}
          />
          <Text style={styles.unit}>{unitLabel}</Text>
        </View>
        {hint ? <Text style={styles.hint}>{hint}</Text> : null}
      </View>
    );
  }

  return (
    <Modal visible={visible} animationType="fade" onRequestClose={close} transparent>
      {visible ? (
        <View style={styles.overlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={close} />
          <Pressable
            style={[styles.sheetShell, { maxHeight: maxSheetHeight, bottom: keyboardHeight }]}
            onPress={(event) => event.stopPropagation()}>
            <GlassSheetSurface
              maxHeight={maxSheetHeight}
              contentStyle={styles.sheetContent}
              tintOpacity={0.52}
              blurIntensity={64}>
              <View style={styles.header}>
                <Text style={styles.title}>{t('measurements.title')}</Text>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={t('settings.common.cancel')}
                  hitSlop={12}
                  onPress={close}
                  style={styles.closeButton}>
                  <Ionicons name="close" size={22} color={TEXT_SECONDARY} />
                </Pressable>
              </View>
              <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.body}>
                <Text style={styles.subtitle}>{t('measurements.subtitle')}</Text>
                {CORE_FIELDS.map(renderField)}
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ expanded: showMore }}
                  onPress={() => setShowMore((prev) => !prev)}
                  style={styles.moreRow}>
                  <Text style={styles.moreLabel}>{t('measurements.moreLabel')}</Text>
                  <Ionicons
                    name={showMore ? 'chevron-up' : 'chevron-down'}
                    size={16}
                    color={TEXT_SECONDARY}
                  />
                </Pressable>
                {showMore ? MORE_FIELDS.map(renderField) : null}
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={t('settings.common.save')}
                  disabled={isSaving}
                  style={[styles.saveButton, isSaving && styles.saveButtonDisabled]}
                  onPress={() => void save()}>
                  {isSaving ? (
                    <ActivityIndicator color="#FFFFFF" />
                  ) : (
                    <Text style={styles.saveLabel}>{t('settings.common.save')}</Text>
                  )}
                </Pressable>
              </ScrollView>
            </GlassSheetSurface>
          </Pressable>
        </View>
      ) : null}
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
  },
  sheetShell: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    width: '100%',
  },
  sheetContent: {
    paddingHorizontal: 0,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 4,
  },
  title: {
    flex: 1,
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
  },
  closeButton: {
    padding: 4,
  },
  body: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 8,
  },
  subtitle: {
    marginBottom: 16,
    fontSize: 14,
    fontWeight: '500',
    color: TEXT_SECONDARY,
  },
  field: {
    marginBottom: 14,
  },
  label: {
    marginBottom: 6,
    fontSize: 14,
    fontWeight: '500',
    color: TEXT_SECONDARY,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  input: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: GLASS_SURFACE.backgroundColor,
    borderColor: GLASS_SURFACE.borderColor,
    borderWidth: GLASS_SURFACE.borderWidth,
  },
  unit: {
    width: 28,
    fontSize: 15,
    fontWeight: '500',
    color: TEXT_SECONDARY,
  },
  hint: {
    marginTop: 4,
    fontSize: 12,
    color: TEXT_SECONDARY,
  },
  moreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 8,
    marginBottom: 8,
  },
  moreLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#4F46E5',
  },
  saveButton: {
    height: 48,
    marginTop: 4,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#4F46E5',
  },
  saveButtonDisabled: {
    opacity: 0.65,
  },
  saveLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});
