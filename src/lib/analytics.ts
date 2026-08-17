import PostHog from 'posthog-react-native';

const posthogKey = process.env.EXPO_PUBLIC_POSTHOG_KEY;

export const posthog = posthogKey
  ? new PostHog(posthogKey, {
      host: 'https://eu.i.posthog.com', // EU-Instanz, DSGVO
      disableGeoip: false,
      enableSessionReplay: false,
      // Some PostHog RN SDK versions don't type `autocapture`; we still pass it explicitly.
      autocapture: false,
    } as any)
  : null;

/**
 * IMPORTANT (Kolibi / health data):
 * - Events must NEVER include health values as properties (no calories, no weight, no food names, no DOB).
 * - Only track action-style events (e.g. "barcode_scan_completed") without attaching sensitive values.
 */

export type SignupProvider = 'apple' | 'google' | 'email';

const NEW_USER_MAX_AGE_MS = 60_000;

export function identifyAnalyticsUser(userId: string) {
  if (!posthog || !userId) {
    return;
  }
  posthog.identify(userId);
}

export function resetAnalyticsUser() {
  posthog?.reset();
}

export function isLikelyNewAuthUser(createdAt: string | undefined | null): boolean {
  if (!createdAt) {
    return false;
  }
  const createdMs = Date.parse(createdAt);
  return Number.isFinite(createdMs) && Date.now() - createdMs < NEW_USER_MAX_AGE_MS;
}

export function trackSignupProviderSelected(provider: SignupProvider) {
  posthog?.capture('signup_provider_selected', { provider });
}

export function trackSignupCompleted(provider: SignupProvider) {
  posthog?.capture('signup_completed', { provider });
}

export function identifyAndTrackSignupIfNew(
  user: { id: string; created_at?: string } | null | undefined,
  provider: SignupProvider,
) {
  if (!user?.id) {
    return;
  }
  identifyAnalyticsUser(user.id);
  if (isLikelyNewAuthUser(user.created_at)) {
    trackSignupCompleted(provider);
  }
}

