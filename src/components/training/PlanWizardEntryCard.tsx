import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Href, router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { GlassCard } from '@/components/ui/glass-card';
import { TEXT_SECONDARY } from '@/constants/brand';
import { useRequirePlan } from '@/hooks/use-require-plan';

export const PLAN_WIZARD_HREF = '/koli/plan-wizard' as Href;

/**
 * Opens the plan wizard after the plan-edit gate (AGB Ziffer 10 Abs. 5).
 * Usable from any screen, e.g. onboarding later.
 */
export function useOpenPlanWizard() {
  const requirePlan = useRequirePlan();
  return () => {
    void requirePlan('editPlan').then((allowed) => {
      if (allowed) {
        router.push(PLAN_WIZARD_HREF);
      }
    });
  };
}

/** Big entry for empty training states. */
export function PlanWizardEntryCard({ testID = 'planWizard.entry' }: { testID?: string }) {
  const { t } = useTranslation();
  const openPlanWizard = useOpenPlanWizard();

  return (
    <GlassCard style={styles.card}>
      <View style={styles.header}>
        <Ionicons name="sparkles-outline" size={22} color="#4F46E5" />
        <Text style={styles.title}>{t('planWizard.entry.title')}</Text>
      </View>
      <Text style={styles.subtitle}>{t('planWizard.entry.subtitle')}</Text>
      <Pressable testID={testID} accessibilityRole="button" onPress={openPlanWizard}>
        <LinearGradient
          colors={['#4F46E5', '#7CE7C7']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.button}>
          <Text style={styles.buttonText}>{t('planWizard.entry.cta')}</Text>
        </LinearGradient>
      </Pressable>
    </GlassCard>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: 18,
    gap: 10,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1E1B4B',
  },
  subtitle: {
    fontSize: 15,
    lineHeight: 21,
    color: TEXT_SECONDARY,
  },
  button: {
    marginTop: 4,
    height: 50,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 16,
  },
});
