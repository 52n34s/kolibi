import * as Sentry from '@sentry/react-native';

Sentry.init({
  dsn: process.env.EXPO_PUBLIC_SENTRY_DSN,
  sendDefaultPii: false,
  enableLogs: true,
  tracesSampleRate: 0.2,
});

import '../global.css';
import '@/i18n';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { DarkTheme, DefaultTheme, ThemeProvider } from 'expo-router';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useState } from 'react';
import { useColorScheme } from 'react-native';
import { PostHogProvider } from 'posthog-react-native';

import { useAuthStore } from '@/stores/auth-store';
import { posthog } from '@/lib/analytics';
import { initPurchases, logOutPurchases } from '@/lib/purchases';
import { useAppDayRollover } from '@/hooks/use-app-day-rollover';

SplashScreen.preventAutoHideAsync();

function AppLifecycle({ userId }: { userId: string | null }) {
  useAppDayRollover(userId);
  return null;
}

function RootLayout() {
  const colorScheme = useColorScheme();
  const session = useAuthStore((state) => state.session);
  const initialized = useAuthStore((state) => state.initialized);
  const initialize = useAuthStore((state) => state.initialize);
  const [queryClient] = useState(() => new QueryClient());
  const userId = session?.user?.id ?? null;

  useEffect(() => initialize(), [initialize]);

  useEffect(() => {
    if (initialized) {
      SplashScreen.hideAsync();
    }
  }, [initialized]);

  useEffect(() => {
    if (!initialized) {
      return;
    }

    if (userId) {
      void initPurchases(userId);
    } else {
      void logOutPurchases();
    }
  }, [initialized, userId]);

  if (!initialized) {
    return null;
  }

  const app = (
    <QueryClientProvider client={queryClient}>
      <AppLifecycle userId={userId} />
      <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="index" />
          <Stack.Screen name="(auth)" />
          <Stack.Screen name="home" />
          <Stack.Screen name="koli" options={{ headerShown: false }} />
          <Stack.Screen name="onboarding" />
        </Stack>
      </ThemeProvider>
    </QueryClientProvider>
  );

  if (!posthog) {
    return app;
  }

  try {
    return <PostHogProvider client={posthog}>{app}</PostHogProvider>;
  } catch (error) {
    console.error('[PostHog] provider failed:', error);
    return app;
  }
}

export default Sentry.wrap(RootLayout);
