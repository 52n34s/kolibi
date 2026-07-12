import { useTranslation } from 'react-i18next';

import { CompactSegmentToggle } from '@/components/settings/compact-segment-toggle';
import { SUPPORTED_LANGUAGES, setAppLanguage, type SupportedLanguage } from '@/i18n';

export function LanguageSwitcher() {
  const { i18n } = useTranslation();
  const activeLanguage = i18n.language as SupportedLanguage;

  return (
    <CompactSegmentToggle
      variant="language"
      value={activeLanguage}
      segments={SUPPORTED_LANGUAGES.map((language) => ({
        id: language,
        label: language.toUpperCase(),
      }))}
      onChange={setAppLanguage}
    />
  );
}
