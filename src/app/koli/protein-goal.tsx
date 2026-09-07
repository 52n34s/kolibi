import { Href, Stack, router } from 'expo-router';
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';

import { HomeLayout, useMeshScreenInsets } from '@/components/home/home-layout';
import { ONBOARDING_ACCENT } from '@/components/onboarding/onboarding-styles';
import {
  MacroGoalEditorBody,
  type MacroGoalEditorActions,
} from '@/components/settings/macro-goal-editor-body';
import { SettingsBackButton } from '@/components/settings/settings-back-button';
import { NumberInputAccessory } from '@/components/ui/keyboard-accessory';
import { useKeyboardHeight } from '@/hooks/use-keyboard-height';
import { useAuthStore } from '@/stores/auth-store';

const GOALS_HREF = { pathname: '/koli', params: { segment: 'goals' } } as Href;

export default function ProteinGoalSettingsScreen() {
  const { t } = useTranslation();
  const { contentTopPadding } = useMeshScreenInsets();
  const keyboardHeight = useKeyboardHeight();
  const session = useAuthStore((state) => state.session);
  const userId = session?.user?.id;
  const [actions, setActions] = useState<MacroGoalEditorActions | null>(null);

  const onActionsChange = useCallback((next: MacroGoalEditorActions) => {
    setActions(next);
  }, []);

  return (
    <HomeLayout>
      <Stack.Screen options={{ headerShown: false }} />

      <View className="px-6" style={{ paddingTop: contentTopPadding }}>
        <SettingsBackButton label={t('koli.segments.goals')} href={GOALS_HREF} />
      </View>

      {!userId ? (
        <View className="flex-1 items-center justify-center px-6">
          <Text className="text-center text-base text-gray-600">
            {t('settings.errors.loadFailed')}
          </Text>
        </View>
      ) : (
        <View className="flex-1" style={{ paddingBottom: keyboardHeight }}>
          <ScrollView
            className="flex-1 px-6"
            contentContainerStyle={{ paddingTop: 12, paddingBottom: 32 }}
            keyboardShouldPersistTaps="always">
            <Text className="mb-2 text-2xl font-bold text-gray-900">
              {t('settings.macroGoal.screenTitle')}
            </Text>
            <Text className="mb-6 text-base text-gray-500">
              {t('settings.macroGoal.directEditSubtitle')}
            </Text>

            <MacroGoalEditorBody
              userId={userId}
              hideActions
              onActionsChange={onActionsChange}
              onSaved={() => router.back()}
            />
          </ScrollView>

          <View className="px-6 pb-8">
            <Pressable
              className={`h-12 items-center justify-center rounded-xl ${
                actions?.canSave ? 'bg-[#4F46E5]' : 'bg-indigo-300'
              }`}
              disabled={!actions?.canSave}
              onPress={() => actions?.save()}>
              {actions?.isSaving ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text className="text-base font-semibold text-white">
                  {t('settings.common.save')}
                </Text>
              )}
            </Pressable>
            {actions?.showReset ? (
              <Pressable
                accessibilityRole="button"
                disabled={actions.isSaving || actions.isResetting}
                onPress={() => actions.reset()}
                className="mt-3 items-center py-2">
                {actions.isResetting ? (
                  <ActivityIndicator color={ONBOARDING_ACCENT} />
                ) : (
                  <Text className="text-sm font-medium text-indigo-600">
                    {t('settings.macroGoal.resetToRecommended')}
                  </Text>
                )}
              </Pressable>
            ) : null}
          </View>
        </View>
      )}
      <NumberInputAccessory />
    </HomeLayout>
  );
}
