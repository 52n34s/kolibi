import { Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { HistoryPanel } from '@/components/history/history-panel';
import { HomeLayout, useMeshScreenInsets } from '@/components/home/home-layout';
import { KoliHeaderTitle } from '@/components/koli/koli-header-title';
import {
  KoliSegmentSwitcher,
  type KoliSegment,
} from '@/components/koli/koli-segment-switcher';
import { SettingsAreaPanel } from '@/components/settings/settings-area-panel';
import { SettingsBackButton } from '@/components/settings/settings-back-button';

function resolveInitialSegment(segment: string | string[] | undefined): KoliSegment {
  const value = Array.isArray(segment) ? segment[0] : segment;
  return value === 'settings' ? 'settings' : 'history';
}

function resolveSettingsSubSegment(
  settingsSubSegment: string | string[] | undefined,
): 'profile' | 'security' | 'support' | undefined {
  const value = Array.isArray(settingsSubSegment) ? settingsSubSegment[0] : settingsSubSegment;
  if (value === 'security' || value === 'support' || value === 'profile') {
    return value;
  }

  return undefined;
}

export default function KoliScreen() {
  const { t } = useTranslation();
  const { segment, settingsSubSegment } = useLocalSearchParams<{
    segment?: string;
    settingsSubSegment?: string;
  }>();
  const { contentTopPadding } = useMeshScreenInsets();
  const [activeSegment, setActiveSegment] = useState<KoliSegment>(() =>
    resolveInitialSegment(segment),
  );

  useEffect(() => {
    setActiveSegment(resolveInitialSegment(segment));
  }, [segment]);

  return (
    <HomeLayout>
      <Stack.Screen options={{ headerShown: false }} />

      <View className="flex-1">
        <View className="px-6" style={{ paddingTop: contentTopPadding }}>
          <View className="relative mb-3 min-h-11 flex-row items-center">
            <SettingsBackButton
              label={t('settings.backToHome')}
              href="/home"
            />
            <View
              pointerEvents="none"
              className="absolute inset-x-0 items-center">
              <KoliHeaderTitle accessibilityLabel={t('koli.title')} />
            </View>
          </View>
          <KoliSegmentSwitcher value={activeSegment} onChange={setActiveSegment} />
        </View>

        <View className="mt-4 flex-1">
          {activeSegment === 'history' ? (
            <HistoryPanel />
          ) : (
            <SettingsAreaPanel initialSubSegment={resolveSettingsSubSegment(settingsSubSegment)} />
          )}
        </View>
      </View>
    </HomeLayout>
  );
}
