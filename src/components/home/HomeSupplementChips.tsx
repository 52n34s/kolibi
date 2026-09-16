import { useEffect, useRef, useState } from 'react';
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
import { useAuthStore } from '@/stores/auth-store';

const HIDE_AFTER_COMPLETE_MS = 900;
const CHIP_SCROLL_THRESHOLD = 3;

const DUE_CHIP = {
  backgroundColor: 'rgba(79, 70, 229, 0.12)',
  borderColor: '#4F46E5',
  textColor: '#4F46E5',
} as const;

const DONE_CHIP = {
  backgroundColor: 'rgba(156, 163, 175, 0.14)',
  borderColor: 'rgba(156, 163, 175, 0.35)',
  textColor: '#9CA3AF',
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
  const allDueTaken = dueItems.length > 0 && dueItems.every((item) => item.taken);

  /** Keep row visible briefly after the last chip is completed; hide immediately if already complete on load. */
  const [holdVisible, setHoldVisible] = useState(false);
  const hadIncompleteRef = useRef(false);

  useEffect(() => {
    if (dueItems.length === 0) {
      hadIncompleteRef.current = false;
      setHoldVisible(false);
      return;
    }

    if (!allDueTaken) {
      hadIncompleteRef.current = true;
      setHoldVisible(false);
      return;
    }

    if (!hadIncompleteRef.current) {
      setHoldVisible(false);
      return;
    }

    setHoldVisible(true);
    const timer = setTimeout(() => {
      setHoldVisible(false);
      hadIncompleteRef.current = false;
    }, HIDE_AFTER_COMPLETE_MS);

    return () => clearTimeout(timer);
  }, [allDueTaken, dueItems.length]);

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

  if (allDueTaken && !holdVisible) {
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
    marginTop: 14,
  },
  rowContent: {
    flexDirection: 'row',
    flexWrap: 'nowrap',
    gap: 8,
    alignItems: 'center',
  },
  chip: {
    borderWidth: 1.5,
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
