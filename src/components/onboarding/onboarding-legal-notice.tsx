import { openBrowserAsync, WebBrowserPresentationStyle } from 'expo-web-browser';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';

import { BRAND_INDIGO } from '@/constants/brand';
import { LEGAL_LINKS } from '@/lib/legal-links';

/**
 * Reserved vertical space for scroll padding when the notice is visible.
 * Sized for ~3 lines (12/18) on narrow devices plus bottom gap above Continue.
 */
export const ONBOARDING_LEGAL_NOTICE_HEIGHT = 80;

const styles = StyleSheet.create({
  root: {
    paddingHorizontal: 24,
    paddingTop: 4,
    paddingBottom: 16,
    alignItems: 'center',
  },
  text: {
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '400',
    color: '#9CA3AF',
    textAlign: 'center',
  },
  // Match settings support legal links: font-semibold + BRAND_INDIGO, no underline.
  link: {
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '600',
    color: BRAND_INDIGO,
  },
});

async function openLegalUrl(url: string) {
  await openBrowserAsync(url, {
    presentationStyle: WebBrowserPresentationStyle.AUTOMATIC,
  });
}

/**
 * Standalone legal notice for onboarding step 1.
 * Intentionally self-contained so footer/card/glass redesigns do not touch it.
 */
export function OnboardingLegalNotice() {
  const { t } = useTranslation();

  return (
    <View style={styles.root}>
      <Text style={styles.text}>
        {t('onboarding.legalNotice.before')}
        <Text
          accessibilityRole="link"
          style={styles.link}
          onPress={() => {
            void openLegalUrl(LEGAL_LINKS.termsOfService);
          }}>
          {t('onboarding.legalNotice.terms')}
        </Text>
        {t('onboarding.legalNotice.middle')}
        <Text
          accessibilityRole="link"
          style={styles.link}
          onPress={() => {
            void openLegalUrl(LEGAL_LINKS.privacyPolicy);
          }}>
          {t('onboarding.legalNotice.privacy')}
        </Text>
        {t('onboarding.legalNotice.after')}
      </Text>
    </View>
  );
}
