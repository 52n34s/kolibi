import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { localDateKey } from '@/lib/day-window';
import {
  fetchSupplementsForDay,
  logIntake,
  removeIntake,
  type SupplementForDay,
} from '@/lib/supplements';
import { GLASS_BORDER, GLASS_BORDER_TOP } from '@/constants/brand';
import { useAuthStore } from '@/stores/auth-store';

const CHIP_SCROLL_THRESHOLD = 3;

/** Light glass chrome — same shape both states; done only mutes color. */
const DUE_CHIP = {
  backgroundColor: 'rgba(255, 255, 255, 0.52)',
  borderColor: GLASS_BORDER,
  borderTopColor: GLASS_BORDER_TOP,
  textColor: '#4F46E5',
} as const;

const DONE_CHIP = {
  backgroundColor: 'rgba(255, 255, 255, 0.38)',
  borderColor: 'rgba(156, 163, 175, 0.45)',
  borderTopColor: 'rgba(255, 255, 255, 0.7)',
  textColor: '#6B7280',
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

  // Only hide when nothing is due today (schedule/cycle/interval) or none exist.
  if (dueItems.length === 0) {
    return null;
  }

  const useScroll = dueItems.length > CHIP_SCROLL_THRESHOLD;

  const chips = dueItems.map((item) => {
    const done = item.taken;
    const palette = done ? DONE_CHIP : DUE_CHIP;
    const pending =
      toggleMutation.isPending && toggleMutation.variables?.id === item.id;

    return (
      <Pressable
        key={item.id}
        accessibilityRole="button"
        accessibilityLabel={
          done
            ? t('supplements.homeChip.takenA11y', { name: item.name })
            : t('supplements.homeChip.dueA11y', { name: item.name })
        }
        disabled={toggleMutation.isPending}
        onPress={() => toggleMutation.mutate(item)}
        style={({ pressed }) => [
          styles.chip,
          {
            backgroundColor: palette.backgroundColor,
            borderColor: palette.borderColor,
            borderTopColor: palette.borderTopColor,
            opacity: pressed ? 0.85 : 1,
          },
        ]}>
        {pending ? (
          <ActivityIndicator size="small" color={palette.textColor} />
        ) : (
          <Text style={[styles.chipText, { color: palette.textColor }]} numberOfLines={1}>
            {done ? `${item.name} ✓` : `${item.name} +`}
          </Text>
        )}
      </Pressable>
    );
  });

  if (useScroll) {
    return (
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.row}
        contentContainerStyle={styles.rowContent}>
        {chips}
      </ScrollView>
    );
  }

  return <View style={[styles.row, styles.rowContent]}>{chips}</View>;
}

const styles = StyleSheet.create({
  row: {
    // Same top gap as home blocks (weight uses mt-6 → 24).
    marginTop: 24,
  },
  rowContent: {
    flexDirection: 'row',
    flexWrap: 'nowrap',
    gap: 8,
    alignItems: 'center',
  },
  chip: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
    maxWidth: 160,
    minHeight: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipText: {
    fontSize: 13,
    fontWeight: '600',
  },
});
