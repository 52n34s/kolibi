import * as Sentry from '@sentry/react-native';
import Constants from 'expo-constants';

Sentry.init({
  dsn: process.env.EXPO_PUBLIC_SENTRY_DSN,
  sendDefaultPii: false,
  enableLogs: true,

  // Umgebung & Version explizit setzen
  environment: __DEV__ ? 'development' : 'production',
  release: `kolibi@${Constants.expoConfig?.version ?? '1.0.0'}`,
  dist: String(Constants.expoConfig?.ios?.buildNumber ?? ''),

  // Performance: im Dev aus, in Prod moderat
  tracesSampleRate: __DEV__ ? 0 : 0.2,

  // AppHang explizit (Default 2s beibehalten)
  enableAppHangTracking: true,
  appHangTimeoutInterval: 2,

  // Rauschen filtern statt wegwerfen
  beforeSend(event) {
    // Im Dev nichts an Sentry senden (spart Kontingent, hält Prod-Statistik sauber)
    if (__DEV__) return null;

    // RevenueCat turbo_module AppHang-Rauschen runterstufen statt verwerfen:
    const values = event.exception?.values ?? [];
    const isRcTurboHang = values.some(
      (v) =>
        (v.value ?? '').includes('turbo_module') ||
        (v.value ?? '').includes('subscriber attributes'),
    );
    if (isRcTurboHang) {
      event.level = 'warning';
      event.tags = { ...(event.tags ?? {}), rc_noise: 'true' };
    }
    return event;
  },
});

import '../global.css';
import '@/i18n';

import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import { DarkTheme, DefaultTheme, ThemeProvider } from 'expo-router';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useState } from 'react';
import { useColorScheme } from 'react-native';
import { PostHogProvider } from 'posthog-react-native';

import { useAuthStore } from '@/stores/auth-store';
import { posthog } from '@/lib/analytics';
import { registerPremiumAccessCustomerInfoListener } from '@/lib/premium-query-sync';
import {
  configurePurchasesOnce,
  logInPurchases,
  logOutPurchases,
} from '@/lib/purchases';
import {
  refreshRevenueCatCustomerInfo,
  resetRevenueCatCustomerInfoStore,
} from '@/lib/revenuecat-customer-info';
import { useAppDayRollover } from '@/hooks/use-app-day-rollover';
import { useTouchUserActivity } from '@/hooks/use-touch-user-activity';

SplashScreen.preventAutoHideAsync();

function AppLifecycle({ userId }: { userId: string | null }) {
  useAppDayRollover(userId);
  useTouchUserActivity(userId);
  return null;
}

function PremiumAccessSync({ userId }: { userId: string | null }) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!userId) {
      return;
    }

    return registerPremiumAccessCustomerInfoListener(queryClient, userId);
  }, [queryClient, userId]);

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

  // Configure once at app start (no appUserID); identity is applied via logIn below.
  useEffect(() => {
    if (!initialized) {
      return;
    }

    void configurePurchasesOnce().catch(() => {
      // configurePurchasesOnce already logs; keep UI usable offline.
    });
  }, [initialized]);

  useEffect(() => {
    if (!initialized) {
      return;
    }

    let cancelled = false;

    if (userId) {
      void logInPurchases(userId)
        .then(() => {
          if (!cancelled) {
            return refreshRevenueCatCustomerInfo();
          }
        })
        .catch(() => {
          // logInPurchases already logs; paywall will retry via ensurePurchasesIdentified.
        });
    } else {
      resetRevenueCatCustomerInfoStore();
      void logOutPurchases();
    }

    return () => {
      cancelled = true;
    };
  }, [initialized, userId]);

  if (!initialized) {
    return null;
  }

  const app = (
    <QueryClientProvider client={queryClient}>
      <AppLifecycle userId={userId} />
      <PremiumAccessSync userId={userId} />
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
