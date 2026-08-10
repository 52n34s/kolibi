import * as Updates from 'expo-updates';

/** Max time to block cold launch on OTA check/fetch before continuing with the current bundle. */
export const EAGER_OTA_TIMEOUT_MS = 2500;

/**
 * Cold-launch only: check for an OTA update, fetch it, and reload immediately.
 * Resolves when the current bundle should continue (no update, timeout, or error).
 * If reloadAsync runs, the JS context restarts and this promise may not matter.
 *
 * After the timeout, further reload is skipped so a slow fetch cannot interrupt
 * an already-interactive session.
 */
export async function applyEagerOtaUpdateOnLaunch(
  timeoutMs: number = EAGER_OTA_TIMEOUT_MS,
): Promise<void> {
  if (__DEV__ || !Updates.isEnabled) {
    return;
  }

  let allowReload = true;
  let timeoutId: ReturnType<typeof setTimeout> | undefined;

  const timeoutPromise = new Promise<void>((resolve) => {
    timeoutId = setTimeout(() => {
      allowReload = false;
      resolve();
    }, timeoutMs);
  });

  try {
    await Promise.race([
      (async () => {
        try {
          const update = await Updates.checkForUpdateAsync();
          if (!allowReload || !update.isAvailable) {
            return;
          }

          await Updates.fetchUpdateAsync();
          if (!allowReload) {
            return;
          }

          await Updates.reloadAsync();
        } catch {
          // Offline, Expo Go, or server error — keep the current bundle.
        }
      })(),
      timeoutPromise,
    ]);
  } finally {
    if (timeoutId !== undefined) {
      clearTimeout(timeoutId);
    }
  }
}
