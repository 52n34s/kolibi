import { AppState } from 'react-native';

import i18n from '@/i18n';
import { notifySuccessHaptic } from '@/lib/haptics';
import {
  restLiveActivityContent,
  shouldVibrateOnRestEnd,
} from '@/lib/training/rest-live-activity';
import { useRestTimerStore } from '@/stores/rest-timer-store';
import { useWorkoutSessionStore } from '@/stores/workout-session-store';

import {
  endRestLiveActivity,
  startRestLiveActivity,
  updateRestLiveActivity,
} from '../../../modules/rest-live-activity';

let installed = false;
/** undefined = nothing synced yet (clean up leftovers from the last run). */
let lastKey: string | null | undefined;
/** Set when the session ends while a rest is still on; cleared by the next rest. */
let sessionEnded = false;
let finishTimeout: ReturnType<typeof setTimeout> | null = null;
let nativeQueue: Promise<void> = Promise.resolve();

function isActiveRest(status: string): boolean {
  return status === 'running' || status === 'paused';
}

function enqueue(task: () => Promise<void>): void {
  nativeQueue = nativeQueue.then(task).catch(() => {
    // Native errors only disable the Live Activity.
  });
}

function syncLiveActivity(): void {
  const timer = useRestTimerStore.getState();
  const content = restLiveActivityContent({
    timer,
    session: useWorkoutSessionStore.getState().active,
    sessionEnded,
    lang: i18n.language,
    now: Date.now(),
    t: (key, options) => i18n.t(key, options),
  });
  const key = content ? JSON.stringify(content) : null;
  if (key === lastKey) {
    return;
  }
  const wasShown = lastKey != null;
  lastKey = key;
  enqueue(async () => {
    if (!content) {
      await endRestLiveActivity();
      return;
    }
    if (wasShown && (await updateRestLiveActivity(content))) {
      return;
    }
    await startRestLiveActivity(content);
  });
}

/** Finish the rest on time even when no timer UI is mounted to tick. */
function scheduleFinishCheck(): void {
  if (finishTimeout) {
    clearTimeout(finishTimeout);
    finishTimeout = null;
  }
  const { status, endsAt } = useRestTimerStore.getState();
  if (status !== 'running' || endsAt == null) {
    return;
  }
  finishTimeout = setTimeout(
    () => {
      finishTimeout = null;
      useRestTimerStore.getState().markFinishedIfDue();
    },
    Math.max(0, endsAt - Date.now()) + 50,
  );
}

/**
 * Mirror the rest timer into the iOS Live Activity and vibrate when a rest ends
 * in the foreground. Mounted once in AppLifecycle; idempotent.
 */
export function ensureRestLiveActivitySync(): void {
  if (installed) {
    return;
  }
  installed = true;

  useRestTimerStore.subscribe((state, prev) => {
    if (
      prev.status === 'running' &&
      state.status === 'finished' &&
      AppState.currentState === 'active' &&
      shouldVibrateOnRestEnd(prev.endsAt, Date.now())
    ) {
      notifySuccessHaptic();
    }
    if (!isActiveRest(prev.status) && isActiveRest(state.status)) {
      sessionEnded = false;
    }
    if (state.status !== prev.status || state.endsAt !== prev.endsAt) {
      scheduleFinishCheck();
    }
    syncLiveActivity();
  });

  useWorkoutSessionStore.subscribe((state, prev) => {
    if (prev.active && !state.active) {
      sessionEnded = true;
    }
    syncLiveActivity();
  });

  i18n.on('languageChanged', syncLiveActivity);

  AppState.addEventListener('change', (next) => {
    if (next === 'active') {
      useRestTimerStore.getState().markFinishedIfDue();
      scheduleFinishCheck();
    }
  });

  scheduleFinishCheck();
  syncLiveActivity();
}
