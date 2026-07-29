import * as Application from 'expo-application';
import Constants from 'expo-constants';
import { Platform } from 'react-native';

import { getAppLanguage } from '@/i18n';
import { supabase } from '@/lib/supabase';

export const SUPPORT_MESSAGE_CATEGORIES = [
  'bug',
  'data_issue',
  'feature_request',
  'security_concern',
  'question',
  'praise',
  'other',
] as const;

export type SupportMessageCategory = (typeof SUPPORT_MESSAGE_CATEGORIES)[number];

export function getSupportAppVersion(): string {
  return (
    Constants.expoConfig?.version ??
    Application.nativeApplicationVersion ??
    '1.0.0'
  );
}

export async function submitSupportMessage(params: {
  category: SupportMessageCategory;
  message: string;
}): Promise<void> {
  const trimmed = params.message.trim();
  if (!trimmed) {
    throw new Error('EMPTY_MESSAGE');
  }

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError) {
    throw userError;
  }

  if (!user?.id) {
    throw new Error('NOT_AUTHENTICATED');
  }

  const { error } = await supabase.from('support_messages').insert({
    user_id: user.id,
    category: params.category,
    message: trimmed,
    app_version: getSupportAppVersion(),
    platform: Platform.OS,
    locale: getAppLanguage(),
  });

  if (error) {
    throw error;
  }
}
