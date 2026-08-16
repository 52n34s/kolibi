import * as Updates from 'expo-updates';

/** Max time to block cold launch on OTA check/fetch before continuing with the current bundle. */
export const EAGER_OTA_TIMEOUT_MS = 2500;

/**
 * Cold-launch only: check for an OTA update and download it if available.
 * Does not call reloadAsync — the update applies on the next cold start.
 * Always resolves so the caller can finish splash gating safely.
 */
export async function applyEagerOtaUpdateOnLaunch(
  timeoutMs: number = EAGER_OTA_TIMEOUT_MS,
): Promise<void> {
  try {
    if (__DEV__ || !Updates.isEnabled) {
      return;
    }
  } catch {
    return;
  }

  let timedOut = false;
  let timeoutId: ReturnType<typeof setTimeout> | undefined;

  const clearLaunchTimeout = () => {
    if (timeoutId !== undefined) {
      clearTimeout(timeoutId);
      timeoutId = undefined;
    }
  };

  const timeoutPromise = new Promise<void>((resolve) => {
    timeoutId = setTimeout(() => {
      timedOut = true;
      resolve();
    }, timeoutMs);
  });

  try {
    await Promise.race([
      (async () => {
        try {
          const update = await Updates.checkForUpdateAsync();
          if (timedOut || !update.isAvailable) {
            return;
          }

          await Updates.fetchUpdateAsync();
        } catch {
          // Offline or server error — boot current bundle; retry next launch.
        }
      })(),
      timeoutPromise,
    ]);
  } catch {
    // Prefer a normal boot over any uncertain update-check failure.
  } finally {
    clearLaunchTimeout();
  }
}
