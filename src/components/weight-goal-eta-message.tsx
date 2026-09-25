import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Text, type TextProps } from 'react-native';

import {
  computeWeightGoalEta,
  fuzzyEtaParts,
  localizedMonthName,
  type WeightGoalEtaInput,
  type WeightGoalEtaResult,
} from '@/lib/weight-goal-eta';

type WeightGoalEtaMessageProps = {
  input: WeightGoalEtaInput | null;
  /** Optional precomputed result — skips recomputation when provided. */
  result?: WeightGoalEtaResult | null;
  className?: string;
  style?: TextProps['style'];
  tone?: 'default' | 'warning';
};

export function useWeightGoalEta(
  input: WeightGoalEtaInput | null | undefined,
): WeightGoalEtaResult | null {
  return useMemo(() => {
    if (input == null) {
      return null;
    }
    return computeWeightGoalEta(input);
  }, [input]);
}

export function formatWeightGoalEtaMessage(
  result: WeightGoalEtaResult,
  t: (key: string, options?: Record<string, unknown>) => string,
  locale: string,
): string | null {
  if (result.status === 'unavailable') {
    return null;
  }
  if (result.status === 'not_losing') {
    return t('weightGoalEta.notLosing');
  }
  if (result.status === 'not_gaining') {
    return t('weightGoalEta.notGaining');
  }
  if (result.status === 'over_year') {
    return t('weightGoalEta.overYear');
  }
  if (result.status === 'stalled') {
    return result.plan == null
      ? t('weightGoalEta.stalled')
      : t('weightGoalEta.stalledWithPlan', {
          eta: formatFuzzyEta(result.plan.etaDate, t, locale),
        });
  }

  return t('weightGoalEta.reachedAround', {
    eta: formatFuzzyEta(result.etaDate, t, locale),
  });
}

function formatFuzzyEta(
  etaDate: Date,
  t: (key: string, options?: Record<string, unknown>) => string,
  locale: string,
): string {
  const parts = fuzzyEtaParts(etaDate);
  return t('weightGoalEta.fuzzy', {
    part: t(`weightGoalEta.part.${parts.part}`),
    month: localizedMonthName(parts.monthDate, locale),
    year: parts.year,
  });
}

export function WeightGoalEtaMessage({
  input,
  result: resultProp,
  className,
  style,
  tone = 'default',
}: WeightGoalEtaMessageProps) {
  const { t, i18n } = useTranslation();
  const computed = useWeightGoalEta(resultProp == null ? input : null);
  const result = resultProp ?? computed;

  const message = useMemo(() => {
    if (result == null) {
      return null;
    }
    return formatWeightGoalEtaMessage(result, t, i18n.language);
  }, [i18n.language, result, t]);

  if (message == null) {
    return null;
  }

  const isWarning =
    tone === 'warning' ||
    result?.status === 'not_losing' ||
    result?.status === 'not_gaining';

  return (
    <Text
      className={
        className ??
        (isWarning ? 'text-sm text-amber-700' : 'text-sm text-gray-600')
      }
      style={style}>
      {message}
    </Text>
  );
}
