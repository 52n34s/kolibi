import { Stack } from 'expo-router';

import { usePasswordRecoveryDeepLink } from '@/hooks/use-password-recovery-deep-link';

export default function AuthLayout() {
  usePasswordRecoveryDeepLink();

  return <Stack screenOptions={{ headerShown: false }} />;
}
