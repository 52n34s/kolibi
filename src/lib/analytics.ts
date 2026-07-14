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

