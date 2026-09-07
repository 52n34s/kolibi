import { Href, Stack, router } from 'expo-router';
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';

import { HomeLayout, useMeshScreenInsets } from '@/components/home/home-layout';
import {
  MovementGoalEditorBody,
  type MovementGoalEditorActions,
} from '@/components/settings/movement-goal-editor-body';
import { SettingsBackButton } from '@/components/settings/settings-back-button';
import { NumberInputAccessory } from '@/components/ui/keyboard-accessory';
import { useAuthStore } from '@/stores/auth-store';

const GOALS_HREF = { pathname: '/koli', params: { segment: 'goals' } } as Href;

export default function MovementGoalSettingsScreen() {
  const { t } = useTranslation();
  const { contentTopPadding } = useMeshScreenInsets();
  const session = useAuthStore((state) => state.session);
  const userId = session?.user?.id;
  const [actions, setActions] = useState<MovementGoalEditorActions | null>(null);

  const onActionsChange = useCallback((next: MovementGoalEditorActions) => {
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
        <KeyboardAvoidingView
          className="flex-1"
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView
            className="flex-1 px-6"
            contentContainerStyle={{ paddingTop: 12, paddingBottom: 32 }}
            keyboardShouldPersistTaps="always">
            <Text className="mb-2 text-2xl font-bold text-gray-900">
              {t('settings.movementGoal.screenTitle')}
            </Text>
            <Text className="mb-6 text-base text-gray-500">
              {t('settings.movementGoal.directEditSubtitle')}
            </Text>

            <MovementGoalEditorBody
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
          </View>
        </KeyboardAvoidingView>
      )}
      <NumberInputAccessory />
    </HomeLayout>
  );
}
