import { useTranslation } from 'react-i18next';

import { PillSegmentSwitcher } from '@/components/koli/pill-segment-switcher';

export type KoliSegment = 'history' | 'goals' | 'settings';

type KoliSegmentSwitcherProps = {
  value: KoliSegment;
  onChange: (segment: KoliSegment) => void;
};

export function KoliSegmentSwitcher({ value, onChange }: KoliSegmentSwitcherProps) {
  const { t } = useTranslation();

  return (
    <PillSegmentSwitcher
      value={value}
      onChange={onChange}
      segments={[
        { id: 'history', label: t('history.title') },
        { id: 'goals', label: t('koli.segments.goals') },
        { id: 'settings', label: t('settings.title') },
      ]}
    />
  );
}
