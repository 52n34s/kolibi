import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { GLASS_SURFACE } from '@/components/ui/glass-styles';
import {
  BRAND_INDIGO,
  BRAND_INDIGO_DEEP,
  CHIP_BORDER,
  CHIP_SURFACE_SELECTED,
  GLASS_BORDER_TOP,
} from '@/constants/brand';
import { localDateKey } from '@/lib/day-window';
import {
  fetchSupplementsForDay,
  logIntake,
  removeIntake,
  type SupplementForDay,
} from '@/lib/supplements';
import { useAuthStore } from '@/stores/auth-store';

/**
 * Open: frame only. Taken: same frame, filled.
 * The taken label darkens because the fill costs the lighter indigo its
 * contrast (3.4:1) — same hue, so the state still reads without colour coding.
 */
const OPEN_CHIP = {
  backgroundColor: 'transparent',
  textColor: BRAND_INDIGO,
} as const;

const TAKEN_CHIP = {
  backgroundColor: CHIP_SURFACE_SELECTED,
  textColor: BRAND_INDIGO_DEEP,
} as const;

function supplementsDayQueryKey(userId: string, date: string) {
  return ['supplements', 'day', userId, date] as const;
}

type HomeSupplementChipsProps = {
  date?: string;
};

export function HomeSupplementChips({ date }: HomeSupplementChipsProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  // Pressed state rides on React state, not Pressable's style callback: the
  // NativeWind interop owns the style prop and drops the function form, which
  // silently costs the chip its border and padding.
  const [pressedId, setPressedId] = useState<string | null>(null);
  const userId = useAuthStore((state) => state.session?.user?.id);
  const dateKey = date ?? localDateKey();
  const queryKey = userId
    ? supplementsDayQueryKey(userId, dateKey)
    : (['supplements', 'day'] as const);

  const { data, isLoading } = useQuery({
    queryKey,
    enabled: Boolean(userId),
    queryFn: () => fetchSupplementsForDay(dateKey),
  });

  // Every supplement due today stays in the row, taken or not — tapping just
  // toggles its own chip between the open and taken style.
  const dueItems = (data ?? []).filter((item) => item.is_due);

  const toggleMutation = useMutation({
    mutationFn: async (item: SupplementForDay) => {
      if (item.taken) {
        await removeIntake(item.id, dateKey);
      } else {
        await logIntake(item.id, dateKey);
      }
    },
    onMutate: async (item) => {
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<SupplementForDay[]>(queryKey);
      queryClient.setQueryData<SupplementForDay[]>(queryKey, (current) =>
        (current ?? []).map((entry) =>
          entry.id === item.id ? { ...entry, taken: !entry.taken } : entry,
        ),
      );
      return { previous };
    },
    onError: (toggleError, _item, context) => {
      console.error('[HomeSupplementChips] toggle failed:', toggleError);
      if (context?.previous) {
        queryClient.setQueryData(queryKey, context.previous);
      }
    },
    onSettled: async () => {
      await queryClient.invalidateQueries({ queryKey: ['supplements'] });
    },
  });

  if (!userId || isLoading) {
    return null;
  }

  if (dueItems.length === 0) {
    return null;
  }

  return (
    <View style={styles.row}>
      {dueItems.map((item) => {
        const taken = item.taken;
        const palette = taken ? TAKEN_CHIP : OPEN_CHIP;
        const pending =
          toggleMutation.isPending && toggleMutation.variables?.id === item.id;

        return (
          <Pressable
            key={item.id}
            accessibilityRole="button"
            accessibilityState={{ selected: taken }}
            accessibilityLabel={
              taken
                ? t('supplements.homeChip.takenA11y', { name: item.name })
                : t('supplements.homeChip.dueA11y', { name: item.name })
            }
            disabled={toggleMutation.isPending}
            onPress={() => toggleMutation.mutate(item)}
            onPressIn={() => setPressedId(item.id)}
            onPressOut={() => setPressedId(null)}
            style={[
              styles.chip,
              { backgroundColor: palette.backgroundColor },
              pressedId === item.id ? styles.chipPressed : null,
            ]}>
            {pending ? (
              <ActivityIndicator size="small" color={palette.textColor} />
            ) : (
              <Text style={[styles.chipText, { color: palette.textColor }]} numberOfLines={1}>
                {taken ? `${item.name} ✓` : `${item.name} +`}
              </Text>
            )}
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    marginTop: 8,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    alignItems: 'center',
  },
  chip: {
    borderWidth: GLASS_SURFACE.borderWidth,
    borderColor: CHIP_BORDER,
    borderTopColor: GLASS_BORDER_TOP,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
    maxWidth: 160,
    minHeight: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipPressed: {
    opacity: 0.85,
  },
  chipText: {
    fontSize: 13,
    fontWeight: '600',
  },
});
