import { StyleSheet } from 'react-native';

export const mealEntrySheetStyles = StyleSheet.create({
  sheetBody: {
    flexGrow: 0,
  },
  title: {
    marginBottom: 12,
    fontSize: 18,
    fontWeight: '600',
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
  saveHint: {
    marginBottom: 8,
    fontSize: 13,
    fontWeight: '500',
    color: '#B45309',
    textAlign: 'center',
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginBottom: 12,
    paddingVertical: 8,
  },
  addButtonLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: '#4F46E5',
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
  deleteMealButton: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
    paddingVertical: 8,
  },
  deleteMealLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: '#DC2626',
  },
  loadingState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
    gap: 12,
  },
  loadingLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#6B7280',
  },
});
