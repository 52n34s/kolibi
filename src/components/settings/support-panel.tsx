import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { ExternalLink } from '@/components/external-link';
import { SettingsSection } from '@/components/settings/settings-section';
import { ONBOARDING_ACCENT } from '@/components/onboarding/onboarding-styles';
import {
  GLASS_SURFACE,
  SETTINGS_GLASS_DIVIDER_CLASS,
  getGlassCardStyle,
} from '@/components/ui/glass-styles';
import { LEGAL_LINKS } from '@/lib/legal-links';

const SUPPORT_CATEGORIES = [
  'bug',
  'dataIssue',
  'featureRequest',
  'securityConcern',
  'question',
  'praise',
  'other',
] as const;

type SupportCategory = (typeof SUPPORT_CATEGORIES)[number];

export function SupportPanel() {
  const { t } = useTranslation();
  const [category, setCategory] = useState<SupportCategory>('question');
  const [message, setMessage] = useState('');
  const [isSending, setIsSending] = useState(false);

  const categories = useMemo(
    () =>
      SUPPORT_CATEGORIES.map((id) => ({
        id,
        label: t(`settings.support.categories.${id}`),
      })),
    [t],
  );

  function handleSend() {
    if (!message.trim()) {
      Alert.alert(t('settings.errors.title'), t('settings.support.messageRequired'));
      return;
    }

    setIsSending(true);

    setTimeout(() => {
      setIsSending(false);
      Alert.alert(t('settings.support.sentTitle'), t('settings.support.sentMessage'));
      setMessage('');
    }, 600);
  }

  return (
    <ScrollView
      className="flex-1 px-6"
      contentContainerStyle={{ paddingBottom: 40 }}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled">
      <Text className="mb-4 text-base text-gray-600">{t('settings.support.intro')}</Text>

      <SettingsSection title={t('settings.support.categorySectionTitle')}>
        <View className="flex-row flex-wrap gap-2 px-4 py-4">
          {categories.map((item) => {
            const isActive = category === item.id;

            return (
              <Pressable
                key={item.id}
                style={[
                  styles.categoryChip,
                  isActive ? styles.categoryChipActive : styles.categoryChipIdle,
                ]}
                onPress={() => setCategory(item.id)}>
                <Text
                  className={`text-xs font-semibold ${
                    isActive ? 'text-white' : 'text-gray-600'
                  }`}>
                  {item.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </SettingsSection>

      <SettingsSection title={t('settings.support.messageSectionTitle')} unframed>
        <TextInput
          multiline
          numberOfLines={6}
          textAlignVertical="top"
          placeholder={t('settings.support.messagePlaceholder')}
          value={message}
          onChangeText={setMessage}
          className="min-h-[140px] w-full self-stretch px-3 py-3 text-base text-gray-900"
          style={getGlassCardStyle({ borderRadius: 12, minHeight: 140, width: '100%', alignSelf: 'stretch' })}
        />
      </SettingsSection>

      <Pressable
        className="mb-8 h-12 items-center justify-center rounded-xl bg-[#4F46E5]"
        disabled={isSending}
        onPress={handleSend}>
        <Text className="text-base font-semibold text-white">
          {isSending ? t('settings.support.sending') : t('settings.support.send')}
        </Text>
      </Pressable>

      <SettingsSection title={t('settings.support.legalSectionTitle')}>
        <ExternalLink href={LEGAL_LINKS.privacyPolicy} asChild>
          <Pressable className={`border-b ${SETTINGS_GLASS_DIVIDER_CLASS} px-4 py-3.5`}>
            <Text className="text-base font-semibold text-[#4F46E5]">
              {t('settings.support.legal.privacyPolicy')}
            </Text>
          </Pressable>
        </ExternalLink>
        <ExternalLink href={LEGAL_LINKS.termsOfService} asChild>
          <Pressable className={`border-b ${SETTINGS_GLASS_DIVIDER_CLASS} px-4 py-3.5`}>
            <Text className="text-base font-semibold text-[#4F46E5]">
              {t('settings.support.legal.termsOfService')}
            </Text>
          </Pressable>
        </ExternalLink>
        <ExternalLink href={LEGAL_LINKS.imprint} asChild>
          <Pressable className="px-4 py-3.5">
            <Text className="text-base font-semibold text-[#4F46E5]">
              {t('settings.support.legal.imprint')}
            </Text>
          </Pressable>
        </ExternalLink>
      </SettingsSection>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  categoryChip: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  categoryChipIdle: {
    backgroundColor: GLASS_SURFACE.backgroundColor,
    borderColor: GLASS_SURFACE.borderColor,
  },
  categoryChipActive: {
    backgroundColor: ONBOARDING_ACCENT,
    borderColor: ONBOARDING_ACCENT,
  },
});
