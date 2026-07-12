import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';

import { PillSegmentSwitcher } from '@/components/koli/pill-segment-switcher';
import { ProfilePanel } from '@/components/settings/profile-panel';
import { SecurityPanel } from '@/components/settings/security-panel';
import { SupportPanel } from '@/components/settings/support-panel';

export type SettingsSubSegment = 'profile' | 'security' | 'support';

type SettingsAreaPanelProps = {
  initialSubSegment?: SettingsSubSegment;
};

function resolveSubSegment(value: string | undefined): SettingsSubSegment {
  if (value === 'security' || value === 'support') {
    return value;
  }

  return 'profile';
}

export function SettingsAreaPanel({ initialSubSegment }: SettingsAreaPanelProps) {
  const { t } = useTranslation();
  const [activeSubSegment, setActiveSubSegment] = useState<SettingsSubSegment>(() =>
    resolveSubSegment(initialSubSegment),
  );

  useEffect(() => {
    setActiveSubSegment(resolveSubSegment(initialSubSegment));
  }, [initialSubSegment]);

  return (
    <View className="flex-1">
      <View className="mb-4 px-6">
        <Text className="mb-3 text-lg font-semibold text-gray-900">{t('settings.title')}</Text>
        <PillSegmentSwitcher
          compact
          value={activeSubSegment}
          onChange={setActiveSubSegment}
          segments={[
            { id: 'profile', label: t('settings.subSegments.profile') },
            { id: 'security', label: t('settings.subSegments.security') },
            { id: 'support', label: t('settings.subSegments.support') },
          ]}
        />
      </View>

      <View className="flex-1">
        {activeSubSegment === 'profile' ? (
          <ProfilePanel />
        ) : activeSubSegment === 'security' ? (
          <SecurityPanel onOpenProfile={() => setActiveSubSegment('profile')} />
        ) : (
          <SupportPanel />
        )}
      </View>
    </View>
  );
}
