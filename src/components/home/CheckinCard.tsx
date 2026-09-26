import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, AppState, Pressable, Text, View } from 'react-native';

import {
  getOnboardingIdleCardStyle,
  ONBOARDING_CARD_RADIUS,
} from '@/components/onboarding/onboarding-styles';
import { BRAND_INDIGO } from '@/constants/brand';
import {
  useCheckinQuestionsRequested,
  useReadiness,
  useSaveCheckin,
  useSkipCheckinToday,
  useTodayCheckinState,
  useUpdateCheckinSettings,
} from '@/hooks/use-checkin';
import { checkinScaleLabelOrder, orderedCheckinSteps } from '@/lib/checkin/checkin-scale';
import { checkinCardMode } from '@/lib/checkin/checkin-status';
import type { CheckinAnswers, ReadinessResult } from '@/lib/checkin/readiness';

const QUESTIONS = ['sleep', 'energy', 'soreness', 'stress'] as const;
type Question = (typeof QUESTIONS)[number];
const STEPS = [1, 2, 3, 4, 5] as const;

type Draft = Partial<Record<Question, number>>;

function isComplete(draft: Draft): draft is CheckinAnswers {
  return QUESTIONS.every((q) => typeof draft[q] === 'number');
}

/** Refreshes on return to the app, so the 12:00 window is judged per opening. */
function useOpenedAt(): Date {
  const [openedAt, setOpenedAt] = useState(() => new Date());
  useEffect(() => {
    const sub = AppState.addEventListener('change', (next) => {
      if (next === 'active') {
        setOpenedAt(new Date());
      }
    });
    return () => sub.remove();
  }, []);
  return openedAt;
}

export function readinessLine(
  t: (key: string, options?: Record<string, unknown>) => string,
  readiness: ReadinessResult,
): string {
  const sentence = t(readiness.message.key, {
    ...readiness.message.params,
    defaultValue: t('checkin.readiness.sore.general'),
  });
  const action = t(readiness.action.key, readiness.action.params);
  return `${sentence} ${action}`;
}

/**
 * Morning check-in on the Today screen. Inline card, never a pop-up:
 * four questions until 12:00, then gone; after answering, one result line.
 */
export function CheckinCard() {
  const { t } = useTranslation();
  const { status, todayCheckin } = useTodayCheckinState();
  const readiness = useReadiness();
  const saveMutation = useSaveCheckin();
  const settingsMutation = useUpdateCheckinSettings();
  const skipToday = useSkipCheckinToday();
  const openedAt = useOpenedAt();
  const [draft, setDraft] = useState<Draft>({});
  const [editing, setEditing] = useState(false);
  const [saveFailed, setSaveFailed] = useState(false);

  // A recommendation can ask for the questions after the morning window.
  const requested = useCheckinQuestionsRequested();
  const mode = editing
    ? 'questions'
    : requested && status === 'open'
      ? 'questions'
      : checkinCardMode(status, openedAt);

  if (mode === 'hidden') {
    return null;
  }

  const cardStyle = [getOnboardingIdleCardStyle(), { borderRadius: ONBOARDING_CARD_RADIUS }];

  if (mode === 'result') {
    if (!readiness || readiness.basis !== 'checkin') {
      return null;
    }
    return (
      <Pressable
        testID="home.checkin.result"
        accessibilityRole="button"
        accessibilityHint={t('checkin.card.editHint')}
        onPress={() => {
          setDraft(todayCheckin ? { ...todayCheckin } : {});
          setSaveFailed(false);
          setEditing(true);
        }}
        className="mb-4"
        style={cardStyle}>
        <View className="px-5 py-3">
          <Text className="text-sm text-gray-900">
            <Text className="font-semibold" style={{ color: BRAND_INDIGO }}>
              {t(`checkin.level.${readiness.level}`)}
            </Text>
            {` · ${readinessLine(t, readiness)}`}
          </Text>
          {readiness.learning ? (
            <Text className="mt-1 text-xs text-gray-500">{t('checkin.learning')}</Text>
          ) : null}
        </View>
      </Pressable>
    );
  }

  const busy = saveMutation.isPending || settingsMutation.isPending;

  function save() {
    if (!isComplete(draft) || busy) {
      return;
    }
    setSaveFailed(false);
    saveMutation.mutate(
      { sleep: draft.sleep, energy: draft.energy, soreness: draft.soreness, stress: draft.stress },
      {
        onSuccess: () => setEditing(false),
        onError: (error) => {
          console.error('[CheckinCard] save failed:', error);
          setSaveFailed(true);
        },
      },
    );
  }

  return (
    <View testID="home.checkin.card" className="mb-4" style={cardStyle}>
      <View className="px-5 pt-4 pb-3">
        <Text className="mb-3 text-base font-semibold text-gray-900">
          {t('checkin.card.title')}
        </Text>

        {QUESTIONS.map((question) => {
          const [leftLabelKey, rightLabelKey] = checkinScaleLabelOrder(question);
          const steps = orderedCheckinSteps(STEPS, question);
          return (
            <View key={question} className="mb-3">
              <View className="mb-1.5 flex-row items-baseline justify-between">
                <Text className="text-sm font-medium text-gray-800">
                  {t(`checkin.questions.${question}`)}
                </Text>
                <Text className="text-xs text-gray-500">
                  {t(`checkin.scale.${question}.${leftLabelKey}`)} –{' '}
                  {t(`checkin.scale.${question}.${rightLabelKey}`)}
                </Text>
              </View>
              <View className="flex-row" style={{ gap: 6 }}>
                {steps.map((step) => {
                  const selected = draft[question] === step;
                  return (
                    <Pressable
                      key={step}
                      testID={`home.checkin.${question}.${step}`}
                      accessibilityRole="button"
                      accessibilityState={{ selected }}
                      accessibilityLabel={t('checkin.scale.stepLabel', {
                        question: t(`checkin.questions.${question}`),
                        value: step,
                      })}
                      onPress={() => setDraft((current) => ({ ...current, [question]: step }))}
                      className={`h-9 flex-1 items-center justify-center rounded-lg border ${
                        selected ? 'border-[#4F46E5] bg-[#4F46E5]' : 'border-gray-200 bg-white/70'
                      }`}>
                      <Text
                        className={`text-sm font-semibold ${
                          selected ? 'text-white' : 'text-gray-700'
                        }`}>
                        {step}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          );
        })}

        {saveFailed ? (
          <Text className="mb-2 text-sm text-amber-700">{t('checkin.card.saveFailed')}</Text>
        ) : null}

        <Pressable
          testID="home.checkin.save"
          accessibilityRole="button"
          disabled={!isComplete(draft) || busy}
          onPress={save}
          className={`mt-1 h-11 items-center justify-center rounded-xl ${
            isComplete(draft) ? 'bg-[#4F46E5]' : 'bg-indigo-200'
          }`}>
          {saveMutation.isPending ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text className="text-base font-semibold text-white">{t('checkin.card.save')}</Text>
          )}
        </Pressable>

        {editing ? null : (
          <View className="mt-2 flex-row justify-between">
            <Pressable
              testID="home.checkin.skipToday"
              accessibilityRole="button"
              disabled={busy}
              onPress={skipToday}
              className="py-2 pr-3">
              <Text className="text-sm font-medium text-gray-600">
                {t('checkin.card.skipToday')}
              </Text>
            </Pressable>
            <Pressable
              testID="home.checkin.dontShowAgain"
              accessibilityRole="button"
              disabled={busy}
              onPress={() => settingsMutation.mutate({ enabled: false })}
              className="py-2 pl-3">
              <Text className="text-sm font-medium text-gray-600">
                {t('checkin.card.dontShowAgain')}
              </Text>
            </Pressable>
          </View>
        )}
      </View>
    </View>
  );
}
