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
import { DefaultTheme, ThemeProvider, router } from 'expo-router';
import { Stack } from 'expo-router';
import * as Notifications from 'expo-notifications';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useState } from 'react';
import { Appearance } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { PostHogProvider } from 'posthog-react-native';

import { ExerciseImageViewerHost } from '@/components/training/ExerciseImageViewer';
import { GlobalPaywallHost } from '@/components/paywall/GlobalPaywallHost';
import { useAuthStore } from '@/stores/auth-store';
import { posthog } from '@/lib/analytics';
import { applyEagerOtaUpdateOnLaunch } from '@/lib/eager-ota-update';
import {
  maybeUpgradeHealthReadTypesV2,
  maybeUpgradeHealthReadTypesV3,
  maybeUpgradeHealthReadTypesV4,
  maybeUpgradeHealthReadTypesV5,
  syncHealthStatsForRecentDays,
} from '@/lib/health';
import { ensurePushRegistration } from '@/lib/notifications';
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
import { ensureWorkoutSyncListeners } from '@/lib/workouts/sync-queue-runtime';
import { useAppDayRollover } from '@/hooks/use-app-day-rollover';
import { useTouchUserActivity } from '@/hooks/use-touch-user-activity';
import { useTrainingKeepAwake } from '@/hooks/use-training-keep-awake';

// Lock before first paint — GlassView / UIKit follow this, not only ThemeProvider.
Appearance.setColorScheme('light');

SplashScreen.preventAutoHideAsync();

function navigateFromPushData(data: unknown) {
  if (!data || typeof data !== 'object') {
    return;
  }
  const url = 'url' in data ? (data as { url?: unknown }).url : undefined;
  if (typeof url === 'string' && url === '/home') {
    router.replace('/home');
  }
}

function AppLifecycle({ userId }: { userId: string | null }) {
  useAppDayRollover(userId);
  useTouchUserActivity(userId);
  useTrainingKeepAwake();

  useEffect(() => {
    ensureWorkoutSyncListeners();
  }, []);

  useEffect(() => {
    const response = Notifications.getLastNotificationResponse();
    if (response) {
      navigateFromPushData(response.notification.request.content.data);
    }

    const subscription = Notifications.addNotificationResponseReceivedListener((event) => {
      navigateFromPushData(event.notification.request.content.data);
    });

    return () => subscription.remove();
  }, []);

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
  // Kolibi is light-only — lock RN appearance so GlassView / system widgets
  // do not follow the iPhone dark mode setting.
  useEffect(() => {
    Appearance.setColorScheme('light');
  }, []);

  const session = useAuthStore((state) => state.session);
  const initialized = useAuthStore((state) => state.initialized);
  const initialize = useAuthStore((state) => state.initialize);
  const [queryClient] = useState(() => new QueryClient());
  const [otaCheckDone, setOtaCheckDone] = useState(false);
  const userId = session?.user?.id ?? null;
  const appReady = initialized && otaCheckDone;

  useEffect(() => initialize(), [initialize]);

  // Cold launch only (mount once) — not on foreground. Keeps splash up during check.
  // Downloads updates in the background; they apply on the next cold start (no reloadAsync).
  useEffect(() => {
    let cancelled = false;

    void applyEagerOtaUpdateOnLaunch().finally(() => {
      if (!cancelled) {
        setOtaCheckDone(true);
      }
    });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (appReady) {
      SplashScreen.hideAsync();
    }
  }, [appReady]);

  // Catch-up token upsert when OS already granted — never prompts (askIfUndetermined: false).
  useEffect(() => {
    if (!initialized || !userId) {
      return;
    }

    void ensurePushRegistration(userId, { askIfUndetermined: false });
  }, [initialized, userId]);

  // HealthKit → daily_health_stats for history; no-op when health_connected is false.
  useEffect(() => {
    if (!initialized || !userId) {
      return;
    }

    void syncHealthStatsForRecentDays(userId);
  }, [initialized, userId]);

  // One-time reauth for expanded HealthKit read types (existing connected users).
  useEffect(() => {
    if (!initialized || !userId) {
      return;
    }

    void maybeUpgradeHealthReadTypesV2(userId);
    void maybeUpgradeHealthReadTypesV3(userId);
    void maybeUpgradeHealthReadTypesV4(userId);
    void maybeUpgradeHealthReadTypesV5(userId);
  }, [initialized, userId]);

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

  if (!appReady) {
    return null;
  }

  const app = (
    <QueryClientProvider client={queryClient}>
      <AppLifecycle userId={userId} />
      <PremiumAccessSync userId={userId} />
      <ThemeProvider value={DefaultTheme}>
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="index" />
          <Stack.Screen name="(auth)" />
          <Stack.Screen name="home" />
          <Stack.Screen name="koli" options={{ headerShown: false }} />
          <Stack.Screen name="onboarding" />
        </Stack>
      </ThemeProvider>
      <ExerciseImageViewerHost />
      <GlobalPaywallHost />
    </QueryClientProvider>
  );

  let tree = app;
  if (posthog) {
    try {
      tree = <PostHogProvider client={posthog}>{app}</PostHogProvider>;
    } catch (error) {
      console.error('[PostHog] provider failed:', error);
    }
  }

  return <GestureHandlerRootView style={{ flex: 1 }}>{tree}</GestureHandlerRootView>;
}

export default Sentry.wrap(RootLayout);
