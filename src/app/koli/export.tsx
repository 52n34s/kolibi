import { Ionicons } from '@expo/vector-icons';
import * as Sentry from '@sentry/react-native';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import { useQuery } from '@tanstack/react-query';

import { HomeLayout, useMeshScreenInsets } from '@/components/home/home-layout';
import { PillSegmentSwitcher } from '@/components/koli/pill-segment-switcher';
import { SettingsBackButton } from '@/components/settings/settings-back-button';
import { GlassCard } from '@/components/ui/glass-card';
import { BRAND_INDIGO, TEXT_SECONDARY } from '@/constants/brand';
import { buildExportMarkdown } from '@/lib/export/build-export';
import { buildExportLabels } from '@/lib/export/export-labels';
import { exportRangeKeys, fetchExportData } from '@/lib/export/fetch-export-data';
import type { ExportDays, ExportSectionKey, ExportSections } from '@/lib/export/types';
import { useUnitSystem } from '@/lib/measure-units';
import { useAuthStore } from '@/stores/auth-store';

const DAY_OPTIONS: ExportDays[] = [1, 3, 7, 30];
const SECTION_KEYS: ExportSectionKey[] = ['nutrition', 'training', 'body'];

function parseDays(value: string | string[] | undefined): ExportDays {
  const raw = Array.isArray(value) ? value[0] : value;
  const n = Number(raw);
  if (n === 1 || n === 3 || n === 7 || n === 30) {
    return n;
  }
  return 7;
}

function parseSection(value: string | string[] | undefined): ExportSectionKey | null {
  const raw = Array.isArray(value) ? value[0] : value;
  if (raw === 'nutrition' || raw === 'training' || raw === 'body') {
    return raw;
  }
  return null;
}

export default function ExportScreen() {
  const { t, i18n } = useTranslation();
  const { contentTopPadding } = useMeshScreenInsets();
  const userId = useAuthStore((s) => s.session?.user?.id);
  const unitSystem = useUnitSystem();
  const params = useLocalSearchParams<{ days?: string; section?: string }>();

  const [days, setDays] = useState<ExportDays>(() => parseDays(params.days));
  const [sections, setSections] = useState<ExportSections>(() => {
    const preferred = parseSection(params.section);
    if (preferred) {
      return {
        nutrition: preferred === 'nutrition',
        training: preferred === 'training',
        body: preferred === 'body',
      };
    }
    return { nutrition: true, training: true, body: true };
  });
  const [includeQuestion, setIncludeQuestion] = useState(true);

  useEffect(() => {
    setDays(parseDays(params.days));
    const preferred = parseSection(params.section);
    if (preferred) {
      setSections({
        nutrition: preferred === 'nutrition',
        training: preferred === 'training',
        body: preferred === 'body',
      });
    }
  }, [params.days, params.section]);

  const range = useMemo(() => exportRangeKeys(days), [days]);
  const labels = useMemo(() => buildExportLabels(t, unitSystem), [t, unitSystem]);


  const exportQuery = useQuery({
    queryKey: [
      'export-data',
      userId,
      days,
      sections.nutrition,
      sections.training,
      sections.body,
      i18n.language,
      unitSystem,
    ],
    // AGB Ziffer 10 Abs. 5: the export stays open without an active plan.
    enabled: Boolean(userId),
    staleTime: 60_000,
    queryFn: () =>
      fetchExportData({
        userId: userId!,
        days,
        sections,
        lang: i18n.language,
        t,
      }),
  });

  const markdown = useMemo(() => {
    if (!exportQuery.data) {
      return '';
    }
    return buildExportMarkdown(
      exportQuery.data,
      {
        days,
        sections,
        includeQuestion,
        startKey: range.startKey,
        endKey: range.endKey,
        unitSystem,
      },
      i18n.language,
      labels,
    );
  }, [
    exportQuery.data,
    days,
    sections,
    includeQuestion,
    range.startKey,
    range.endKey,
    unitSystem,
    i18n.language,
    labels,
  ]);

  function toggleSection(key: ExportSectionKey) {
    setSections((prev) => {
      const next = { ...prev, [key]: !prev[key] };
      if (!next.nutrition && !next.training && !next.body) {
        return prev;
      }
      return next;
    });
  }

  async function handleShare() {
    if (!markdown.trim()) {
      return;
    }
    try {
      await Share.share({ message: markdown });
    } catch (error) {
      Sentry.captureException(error);
    }
  }

  return (
    <HomeLayout>
      <Stack.Screen
        options={{
          title: '',
          headerLeft: () => <SettingsBackButton label={t('export.title')} />,
        }}
      />
      <ScrollView
        contentContainerStyle={{
          paddingTop: contentTopPadding,
          paddingHorizontal: 24,
          paddingBottom: 48,
          gap: 14,
        }}
        keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>{t('export.title')}</Text>

        <PillSegmentSwitcher
          compact
          value={String(days) as '1' | '3' | '7' | '30'}
          onChange={(value) => setDays(Number(value) as ExportDays)}
          segments={DAY_OPTIONS.map((n) => ({
            id: String(n) as '1' | '3' | '7' | '30',
            label: t('export.days', { count: n }),
            testID: `export.days.${n}`,
          }))}
        />

        <GlassCard style={styles.card}>
          {SECTION_KEYS.map((key) => (
            <Pressable
              key={key}
              testID={`export.section.${key}`}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: sections[key] }}
              onPress={() => toggleSection(key)}
              style={styles.checkRow}>
              <Ionicons
                name={sections[key] ? 'checkbox' : 'square-outline'}
                size={22}
                color={BRAND_INDIGO}
              />
              <Text style={styles.checkLabel}>{t(`export.sections.${key}`)}</Text>
            </Pressable>
          ))}
          <View style={styles.switchRow}>
            <Text style={styles.checkLabel}>{t('export.includeQuestion')}</Text>
            <Switch
              testID="export.question"
              value={includeQuestion}
              onValueChange={setIncludeQuestion}
              trackColor={{ true: BRAND_INDIGO }}
            />
          </View>
        </GlassCard>

        <Text style={styles.previewLabel}>{t('export.preview')}</Text>
        <GlassCard style={styles.previewCard}>
          {exportQuery.isLoading ? (
            <ActivityIndicator color={BRAND_INDIGO} />
          ) : exportQuery.isError ? (
            <Text style={styles.error}>{t('export.loadFailed')}</Text>
          ) : (
            <ScrollView style={styles.previewScroll} nestedScrollEnabled>
              <Text style={styles.previewText} selectable>
                {markdown}
              </Text>
            </ScrollView>
          )}
        </GlassCard>

        <Pressable
          testID="export.share"
          accessibilityRole="button"
          disabled={!markdown.trim() || exportQuery.isLoading}
          onPress={() => void handleShare()}
          style={[styles.shareBtn, (!markdown.trim() || exportQuery.isLoading) && styles.shareDisabled]}>
          <Ionicons name="share-outline" size={18} color="#fff" />
          <Text style={styles.shareText}>{t('export.share')}</Text>
        </Pressable>
      </ScrollView>
    </HomeLayout>
  );
}

const styles = StyleSheet.create({
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1E1B4B',
  },
  card: {
    padding: 14,
    gap: 12,
  },
  checkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  checkLabel: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    color: '#1E1B4B',
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingTop: 4,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(79,70,229,0.12)',
  },
  previewLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: TEXT_SECONDARY,
  },
  previewCard: {
    padding: 12,
    minHeight: 220,
    maxHeight: 360,
  },
  previewScroll: {
    maxHeight: 336,
  },
  previewText: {
    fontFamily: 'Menlo',
    fontSize: 11,
    lineHeight: 16,
    color: '#1E1B4B',
  },
  error: {
    color: '#B91C1C',
    fontSize: 14,
  },
  shareBtn: {
    marginTop: 4,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: BRAND_INDIGO,
    borderRadius: 999,
    paddingVertical: 14,
  },
  shareDisabled: {
    opacity: 0.45,
  },
  shareText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 16,
  },
});
