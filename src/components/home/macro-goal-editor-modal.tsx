import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';

import { MacroGoalEditorBody } from '@/components/settings/macro-goal-editor-body';
import { GlassSheetSurface } from '@/components/shared/GlassSheetSurface';

export type MacroGoalEditorFlowState = { kind: 'closed' } | { kind: 'editor' };

type MacroGoalEditorModalProps = {
  state: MacroGoalEditorFlowState;
  userId: string | undefined;
  onClose: () => void;
};

export function MacroGoalEditorModal({
  state,
  userId,
  onClose,
}: MacroGoalEditorModalProps) {
  const { t } = useTranslation();
  const { height: windowHeight } = useWindowDimensions();
  const isOpen = state.kind !== 'closed';
  const maxSheetHeight = windowHeight * 0.88;

  return (
    <Modal visible={isOpen} animationType="fade" onRequestClose={onClose} transparent>
      {isOpen && userId ? (
        <View style={styles.overlayRoot}>
          <View style={styles.overlay}>
            <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
            <Pressable
              style={[styles.sheetShell, { maxHeight: maxSheetHeight }]}
              onPress={(event) => event.stopPropagation()}>
              <GlassSheetSurface
                maxHeight={maxSheetHeight}
                contentStyle={styles.sheetContent}>
                <View style={styles.header}>
                  <Text style={styles.title}>{t('settings.macroGoal.sectionTitle')}</Text>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={t('settings.common.cancel')}
                    hitSlop={12}
                    onPress={onClose}
                    style={styles.closeButton}>
                    <Ionicons name="close" size={22} color="#6B7280" />
                  </Pressable>
                </View>
                <MacroGoalEditorBody userId={userId} onSaved={onClose} />
              </GlassSheetSurface>
            </Pressable>
          </View>
        </View>
      ) : null}
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlayRoot: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
  },
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  sheetShell: {
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
});
