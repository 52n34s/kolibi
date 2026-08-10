import * as Updates from 'expo-updates';

/** Max time to block cold launch on OTA check/fetch before continuing with the current bundle. */
export const EAGER_OTA_TIMEOUT_MS = 2500;

/**
 * Outcome of the cold-launch OTA attempt.
 * - `continued` — stay on the current bundle; caller may mark the app ready.
 *
 * If a reload is started, this promise intentionally never settles so no
 * caller `.then` / `.finally` / setState runs after `reloadAsync`.
 */
export type EagerOtaOutcome = 'continued';

/**
 * Cold-launch only: check for an OTA update, fetch it, and reload immediately.
 *
 * Prefer a normal boot on the current bundle over any uncertain update path.
 * If `reloadAsync` is invoked, it is the last JS that should run in this chain —
 * the returned promise never settles afterward.
 */
export async function applyEagerOtaUpdateOnLaunch(
  timeoutMs: number = EAGER_OTA_TIMEOUT_MS,
): Promise<EagerOtaOutcome> {
  try {
    if (__DEV__ || !Updates.isEnabled) {
      return 'continued';
    }
  } catch {
    return 'continued';
  }

  let allowReload = true;
  let timeoutId: ReturnType<typeof setTimeout> | undefined;

  const clearLaunchTimeout = () => {
    if (timeoutId !== undefined) {
      clearTimeout(timeoutId);
      timeoutId = undefined;
    }
  };

  const timeoutPromise = new Promise<EagerOtaOutcome>((resolve) => {
    timeoutId = setTimeout(() => {
      allowReload = false;
      resolve('continued');
    }, timeoutMs);
  });

  try {
    const outcome = await Promise.race([
      (async (): Promise<EagerOtaOutcome> => {
        try {
          const update = await Updates.checkForUpdateAsync();
          if (!allowReload || !update.isAvailable) {
            return 'continued';
          }

          const fetched = await Updates.fetchUpdateAsync();
          if (!allowReload) {
            return 'continued';
          }

          // Only reload when a new update was actually downloaded.
          if (!('isNew' in fetched) || fetched.isNew !== true) {
            return 'continued';
          }

          // Stop the timeout before reload so it cannot fire mid-teardown.
          clearLaunchTimeout();
          allowReload = false;

          // LAST await in this chain. Do not return, notify the caller, or
          // clear more state after this resolves — the process is tearing down.
          // Hang forever so React never setStates on this JS context.
          await Updates.reloadAsync();
          await new Promise<void>(() => {});

          // Unreachable if reload proceeds; satisfies the return type.
          return 'continued';
        } catch {
          // Offline, server error, or reload threw — boot current bundle.
          return 'continued';
        }
      })(),
      timeoutPromise,
    ]);

    return outcome;
  } catch {
    return 'continued';
  } finally {
    // Only reached on `continued` paths (reload hangs before settling).
    clearLaunchTimeout();
  }
}
