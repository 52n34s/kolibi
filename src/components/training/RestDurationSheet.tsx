import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  FlatList,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { GlassBottomSheet } from '@/components/shared/GlassBottomSheet';
import { BRAND_INDIGO, TEXT_SECONDARY } from '@/constants/brand';
import {
  restDurationWheelValues,
  snapRestSeconds,
} from '@/lib/training/rest-timer';
import { useRestTimerStore } from '@/stores/rest-timer-store';

const ITEM_HEIGHT = 44;
const VISIBLE_ROWS = 5;
const WHEEL_HEIGHT = ITEM_HEIGHT * VISIBLE_ROWS;
const WHEEL_PAD = (WHEEL_HEIGHT - ITEM_HEIGHT) / 2;

const WHEEL_VALUES = restDurationWheelValues();

type RestDurationSheetProps = {
  visible: boolean;
  onClose: () => void;
  /** Remaining seconds when the sheet opened (snapped to the wheel). */
  initialSeconds: number;
};

export function RestDurationSheet({
  visible,
  onClose,
  initialSeconds,
}: RestDurationSheetProps) {
  const { t } = useTranslation();
  const restartActiveDuration = useRestTimerStore((s) => s.restartActiveDuration);
  const saveAsStandard = useRestTimerStore((s) => s.saveAsStandard);

  const [selectedSec, setSelectedSec] = useState(() => snapRestSeconds(initialSeconds));
  const listRef = useRef<FlatList<number>>(null);
  const selectedRef = useRef(selectedSec);

  useEffect(() => {
    if (!visible) {
      return;
    }
    const next = snapRestSeconds(initialSeconds);
    setSelectedSec(next);
    selectedRef.current = next;
    const index = Math.max(0, WHEEL_VALUES.indexOf(next));
    requestAnimationFrame(() => {
      listRef.current?.scrollToOffset({ offset: index * ITEM_HEIGHT, animated: false });
    });
  }, [visible, initialSeconds]);

  const snapFromOffset = useCallback((offsetY: number) => {
    const index = Math.round(offsetY / ITEM_HEIGHT);
    const clamped = Math.max(0, Math.min(WHEEL_VALUES.length - 1, index));
    const value = WHEEL_VALUES[clamped]!;
    selectedRef.current = value;
    setSelectedSec(value);
    listRef.current?.scrollToOffset({ offset: clamped * ITEM_HEIGHT, animated: true });
  }, []);

  function handleScrollEnd(event: NativeSyntheticEvent<NativeScrollEvent>) {
    snapFromOffset(event.nativeEvent.contentOffset.y);
  }

  async function handleApply() {
    const sec = selectedRef.current;
    onClose();
    await restartActiveDuration(sec);
  }

  function handleSaveAsStandard() {
    saveAsStandard(selectedRef.current);
  }

  return (
    <GlassBottomSheet visible={visible} onClose={onClose} maxHeightRatio={0.6}>
      <Text style={styles.title}>{t('training.timer.editTitle')}</Text>

      <View style={styles.wheelWrap}>
        <View pointerEvents="none" style={styles.wheelHighlight} />
        <FlatList
          ref={listRef}
          data={WHEEL_VALUES}
          keyExtractor={(item) => String(item)}
          showsVerticalScrollIndicator={false}
          snapToInterval={ITEM_HEIGHT}
          decelerationRate="fast"
          getItemLayout={(_data, index) => ({
            length: ITEM_HEIGHT,
            offset: ITEM_HEIGHT * index,
            index,
          })}
          contentContainerStyle={{ paddingVertical: WHEEL_PAD }}
          style={styles.wheel}
          onMomentumScrollEnd={handleScrollEnd}
          onScrollEndDrag={handleScrollEnd}
          renderItem={({ item }) => {
            const active = item === selectedSec;
            return (
              <View style={styles.wheelItem}>
                <Text style={[styles.wheelText, active && styles.wheelTextActive]}>
                  {t('training.timer.editValue', { seconds: item })}
                </Text>
              </View>
            );
          }}
        />
      </View>

      <Pressable
        testID="training.timerBar.edit.apply"
        accessibilityRole="button"
        onPress={() => void handleApply()}
        style={styles.primary}>
        <Text style={styles.primaryText}>{t('training.timer.editApply')}</Text>
      </Pressable>

      <Pressable
        testID="training.timerBar.edit.saveStandard"
        accessibilityRole="button"
        onPress={handleSaveAsStandard}
        style={styles.standardRow}>
        <Text style={styles.standardTitle}>{t('training.timer.saveAsStandard')}</Text>
        <Text style={styles.standardHint}>{t('training.timer.saveAsStandardHint')}</Text>
      </Pressable>
    </GlassBottomSheet>
  );
}

const styles = StyleSheet.create({
  title: {
    marginBottom: 12,
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
    textAlign: 'center',
  },
  wheelWrap: {
    height: WHEEL_HEIGHT,
    marginBottom: 16,
    position: 'relative',
  },
  wheel: {
    height: WHEEL_HEIGHT,
  },
  wheelHighlight: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: WHEEL_PAD,
    height: ITEM_HEIGHT,
    borderRadius: 12,
    backgroundColor: 'rgba(79, 70, 229, 0.1)',
    zIndex: 0,
  },
  wheelItem: {
    height: ITEM_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  wheelText: {
    fontSize: 20,
    fontWeight: '500',
    color: TEXT_SECONDARY,
    fontVariant: ['tabular-nums'],
  },
  wheelTextActive: {
    color: BRAND_INDIGO,
    fontWeight: '700',
  },
  primary: {
    backgroundColor: BRAND_INDIGO,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
  },
  primaryText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  standardRow: {
    marginTop: 16,
    paddingVertical: 12,
    gap: 4,
  },
  standardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: BRAND_INDIGO,
    textAlign: 'center',
  },
  standardHint: {
    fontSize: 13,
    lineHeight: 18,
    color: TEXT_SECONDARY,
    textAlign: 'center',
  },
});
