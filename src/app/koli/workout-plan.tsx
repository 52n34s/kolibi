import { Ionicons } from '@expo/vector-icons';
import * as Sentry from '@sentry/react-native';
import { Image } from 'expo-image';
import { Href, Stack, router } from 'expo-router';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useQueryClient } from '@tanstack/react-query';

import { HomeLayout, useMeshScreenInsets } from '@/components/home/home-layout';
import { SettingsBackButton } from '@/components/settings/settings-back-button';
import { GlassCard } from '@/components/ui/glass-card';
import {
  BRAND_INDIGO,
  TEXT_SECONDARY,
  TRAINING_UNIT_COLORS,
} from '@/constants/brand';
import { useWorkoutTemplates } from '@/hooks/use-workout-templates';
import { invalidateTrainingQueries } from '@/lib/training-query-keys';
import { clampRestSeconds, DEFAULT_REST_SECONDS } from '@/lib/training/rest-timer';
import type { WorkoutTemplate } from '@/lib/workouts/types';
import { reorderTemplates } from '@/lib/workouts/workouts-api';
import { useAuthStore } from '@/stores/auth-store';
import { useRestTimerStore } from '@/stores/rest-timer-store';

const REST_STEP = 15;
const GOALS_HREF = { pathname: '/koli', params: { segment: 'goals' } } as Href;

function formatWeekdays(
  weekdays: number[],
  t: (key: string, opts?: Record<string, unknown>) => string,
): string {
  if (weekdays.length === 0) {
    return t('training.plan.rotating');
  }
  const sorted = [...weekdays].sort((a, b) => a - b);
  return sorted.map((day) => t(`supplements.schedule.weekdayShort.${day}`)).join(', ');
}

export default function WorkoutPlanScreen() {
  const { t } = useTranslation();
  const { contentTopPadding } = useMeshScreenInsets();
  const queryClient = useQueryClient();
  const userId = useAuthStore((s) => s.session?.user?.id);
  const { data: templates = [], isLoading, isError, refetch } = useWorkoutTemplates();
  const [reordering, setReordering] = useState(false);

  const idleDurationSec = useRestTimerStore((s) => s.idleDurationSec);
  const setIdleDurationSec = useRestTimerStore((s) => s.setIdleDurationSec);
  const restSec = clampRestSeconds(idleDurationSec || DEFAULT_REST_SECONDS);

  const ordered = useMemo(
    () => [...templates].sort((a, b) => a.position - b.position),
    [templates],
  );

  async function move(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= ordered.length || reordering) {
      return;
    }
    const next = [...ordered];
    const [row] = next.splice(index, 1);
    next.splice(target, 0, row!);
    setReordering(true);
    try {
      await reorderTemplates(next.map((item) => item.id));
      if (userId) {
        await invalidateTrainingQueries(queryClient, userId);
      } else {
        await refetch();
      }
    } catch (error) {
      Sentry.captureException(error);
      Alert.alert(t('settings.errors.title'), t('training.plan.reorderFailed'));
    } finally {
      setReordering(false);
    }
  }

  function adjustRest(delta: number) {
    setIdleDurationSec(restSec + delta);
  }

  function metaLine(template: WorkoutTemplate): string {
    const count = template.exercises.length;
    const days = formatWeekdays(template.weekdays, t);
    return t('training.plan.unitMeta', { count, days });
  }

  return (
    <HomeLayout>
      <Stack.Screen options={{ headerShown: false }} />

      <View className="px-6" style={{ paddingTop: contentTopPadding }}>
        <SettingsBackButton label={t('koli.segments.goals')} href={GOALS_HREF} />
      </View>

      <ScrollView
        className="flex-1 px-6"
        contentContainerStyle={{ paddingTop: 12, paddingBottom: 40 }}
        keyboardShouldPersistTaps="handled">
        <Text className="mb-2 text-2xl font-bold text-gray-900">
          {t('training.plan.title')}
        </Text>
        <Text className="mb-6 text-base text-gray-500">{t('training.plan.subtitle')}</Text>

        {isError ? (
          <Text className="text-center text-base text-gray-600">
            {t('training.plan.loadFailed')}
          </Text>
        ) : isLoading ? (
          <ActivityIndicator size="large" color={BRAND_INDIGO} />
        ) : ordered.length === 0 ? (
          <View style={styles.empty}>
            <Image
              source={require('@/assets/images/koli-focused.png')}
              style={styles.koli}
              contentFit="contain"
            />
            <Text style={styles.emptyTitle}>{t('training.plan.emptyTitle')}</Text>
            <Text style={styles.emptyBody}>{t('training.plan.emptyBody')}</Text>
          </View>
        ) : (
          <View style={styles.list}>
            {ordered.map((template, index) => (
              <GlassCard
                key={template.id}
                testID={`training.plan.item.${template.shortLabel}`}
                style={styles.card}>
                <Pressable
                  accessibilityRole="button"
                  onPress={() =>
                    router.push(
                      `/koli/workout-template-edit?id=${encodeURIComponent(template.id)}` as Href,
                    )
                  }
                  style={styles.cardMain}>
                  <View style={styles.cardHeader}>
                    <View
                      style={[
                        styles.dot,
                        {
                          backgroundColor:
                            TRAINING_UNIT_COLORS[template.colorKey] ?? BRAND_INDIGO,
                        },
                      ]}
                    />
                    <Text style={styles.short}>{template.shortLabel}</Text>
                  </View>
                  <Text style={styles.name}>{template.name}</Text>
                  <Text style={styles.meta}>{metaLine(template)}</Text>
                </Pressable>
                <View style={styles.arrows}>
                  <Pressable
                    testID={`training.plan.item.${template.shortLabel}.up`}
                    accessibilityRole="button"
                    disabled={index === 0 || reordering}
                    onPress={() => void move(index, -1)}
                    style={styles.arrowBtn}>
                    <Ionicons
                      name="chevron-up"
                      size={20}
                      color={index === 0 ? '#D1D5DB' : BRAND_INDIGO}
                    />
                  </Pressable>
                  <Pressable
                    testID={`training.plan.item.${template.shortLabel}.down`}
                    accessibilityRole="button"
                    disabled={index >= ordered.length - 1 || reordering}
                    onPress={() => void move(index, 1)}
                    style={styles.arrowBtn}>
                    <Ionicons
                      name="chevron-down"
                      size={20}
                      color={index >= ordered.length - 1 ? '#D1D5DB' : BRAND_INDIGO}
                    />
                  </Pressable>
                </View>
              </GlassCard>
            ))}
          </View>
        )}

        <Pressable
          testID="training.plan.add"
          accessibilityRole="button"
          onPress={() => router.push('/koli/workout-template-edit' as Href)}
          style={styles.primary}>
          <Text style={styles.primaryText}>{t('training.plan.add')}</Text>
        </Pressable>

        <Pressable
          testID="training.plan.catalog"
          accessibilityRole="button"
          onPress={() => router.push('/koli/exercises' as Href)}
          style={styles.linkWrap}>
          <Text style={styles.link}>{t('training.plan.catalog')}</Text>
        </Pressable>

        <View style={styles.restBlock}>
          <Text style={styles.restLabel}>{t('training.plan.restLabel')}</Text>
          <View style={styles.restRow}>
            <Pressable
              testID="training.plan.rest.minus"
              accessibilityRole="button"
              onPress={() => adjustRest(-REST_STEP)}
              style={styles.restBtn}>
              <Text style={styles.restBtnText}>−{REST_STEP}</Text>
            </Pressable>
            <Text style={styles.restValue}>{t('training.plan.restValue', { seconds: restSec })}</Text>
            <Pressable
              testID="training.plan.rest.plus"
              accessibilityRole="button"
              onPress={() => adjustRest(REST_STEP)}
              style={styles.restBtn}>
              <Text style={styles.restBtnText}>+{REST_STEP}</Text>
            </Pressable>
          </View>
          <Text style={styles.restHint}>{t('training.plan.restHint')}</Text>
        </View>
      </ScrollView>
    </HomeLayout>
  );
}

const styles = StyleSheet.create({
  empty: {
    alignItems: 'center',
    gap: 12,
    paddingVertical: 24,
  },
  koli: {
    width: 120,
    height: 120,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1E1B4B',
    textAlign: 'center',
  },
  emptyBody: {
    fontSize: 15,
    color: TEXT_SECONDARY,
    textAlign: 'center',
    lineHeight: 22,
  },
  list: {
    gap: 12,
    marginBottom: 16,
  },
  card: {
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  cardMain: {
    flex: 1,
    gap: 4,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  short: {
    fontSize: 13,
    fontWeight: '700',
    color: TEXT_SECONDARY,
  },
  name: {
    fontSize: 17,
    fontWeight: '700',
    color: '#1E1B4B',
  },
  meta: {
    fontSize: 13,
    color: TEXT_SECONDARY,
  },
  arrows: {
    gap: 2,
  },
  arrowBtn: {
    padding: 6,
  },
  primary: {
    marginTop: 8,
    height: 48,
    borderRadius: 12,
    backgroundColor: BRAND_INDIGO,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 16,
  },
  linkWrap: {
    alignItems: 'center',
    paddingVertical: 14,
  },
  link: {
    color: BRAND_INDIGO,
    fontWeight: '600',
    fontSize: 15,
  },
  restBlock: {
    marginTop: 8,
    gap: 10,
    padding: 16,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.55)',
  },
  restLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
  },
  restRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  restBtn: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: 'rgba(79, 70, 229, 0.12)',
  },
  restBtnText: {
    color: BRAND_INDIGO,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  restValue: {
    flex: 1,
    textAlign: 'center',
    fontSize: 16,
    fontWeight: '700',
    color: BRAND_INDIGO,
    fontVariant: ['tabular-nums'],
  },
  restHint: {
    marginTop: 10,
    fontSize: 13,
    lineHeight: 18,
    color: TEXT_SECONDARY,
    textAlign: 'center',
  },
});
