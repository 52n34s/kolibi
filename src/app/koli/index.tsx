import { Stack, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { HomeLayout, useMeshScreenInsets } from '@/components/home/home-layout';
import { GoalsPanel } from '@/components/koli/goals-panel';
import { KoliHeaderTitle } from '@/components/koli/koli-header-title';
import {
  KoliSegmentSwitcher,
  type KoliSegment,
} from '@/components/koli/koli-segment-switcher';
import { PaywallSheet } from '@/components/paywall/PaywallSheet';
import {
  SettingsAreaPanel,
  type SettingsSubSegment,
} from '@/components/settings/settings-area-panel';
import { SettingsBackButton } from '@/components/settings/settings-back-button';
import { useGatePremiumAccess } from '@/hooks/use-gate-premium-access';

function resolveInitialSegment(segment: string | string[] | undefined): KoliSegment {
  const value = Array.isArray(segment) ? segment[0] : segment;
  if (value === 'settings') {
    return 'settings';
  }
  return 'goals';
}

function resolveSettingsSubSegment(
  settingsSubSegment: string | string[] | undefined,
): SettingsSubSegment | undefined {
  const value = Array.isArray(settingsSubSegment) ? settingsSubSegment[0] : settingsSubSegment;
  if (value === 'plan' || value === 'security' || value === 'support' || value === 'profile') {
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
  const { isAnonymousUser, userId, gatePremiumAccess } = useGatePremiumAccess();
  const [activeSegment, setActiveSegment] = useState<KoliSegment>(() =>
    resolveInitialSegment(segment),
  );
  const [showPaywall, setShowPaywall] = useState(false);

  useEffect(() => {
    setActiveSegment(resolveInitialSegment(segment));
  }, [segment]);

  const switchSegment = useCallback(
    (next: KoliSegment) => {
      void (async () => {
        if (next === 'goals' && !isAnonymousUser) {
          if (!(await gatePremiumAccess())) {
            setShowPaywall(true);
            setActiveSegment('settings');
            return;
          }
        }
        setActiveSegment(next);
      })();
    },
    [gatePremiumAccess, isAnonymousUser],
  );

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
          <KoliSegmentSwitcher value={activeSegment} onChange={switchSegment} />
        </View>

        <View className="mt-4 flex-1">
          {activeSegment === 'goals' ? (
            <GoalsPanel />
          ) : (
            <SettingsAreaPanel initialSubSegment={resolveSettingsSubSegment(settingsSubSegment)} />
          )}
        </View>
      </View>

      <PaywallSheet
        visible={showPaywall}
        userId={userId}
        onClose={() => setShowPaywall(false)}
        withValuePitch
      />
    </HomeLayout>
  );
}
