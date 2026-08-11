import { useTranslation } from 'react-i18next';

import { CompactSegmentToggle } from '@/components/settings/compact-segment-toggle';
import { SUPPORTED_LANGUAGES, setAppLanguage, type SupportedLanguage } from '@/i18n';

type LanguageSwitcherProps = {
  /** Smaller, lower-contrast control for secondary placements (e.g. auth footer). */
  compact?: boolean;
};

export function LanguageSwitcher({ compact = false }: LanguageSwitcherProps) {
  const { i18n } = useTranslation();
  const activeLanguage = i18n.language as SupportedLanguage;

  return (
    <CompactSegmentToggle
      variant="language"
      compact={compact}
      value={activeLanguage}
      segments={SUPPORTED_LANGUAGES.map((language) => ({
        id: language,
        label: language.toUpperCase(),
      }))}
      onChange={setAppLanguage}
      style={compact ? { alignSelf: 'center' } : undefined}
    />
  );
}
