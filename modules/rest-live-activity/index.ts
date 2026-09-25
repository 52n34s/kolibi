import { requireOptionalNativeModule } from 'expo';
import { Platform } from 'react-native';

/** Content of the rest timer Live Activity; mirrors RestLiveActivityProps in Swift. */
export type RestLiveActivityNativeProps = {
  title: string;
  exerciseName: string;
  setLabel: string;
  pausedLabel: string;
  doneLabel: string;
  isPaused: boolean;
  /** Epoch ms where the countdown range starts (progress bar). */
  startMs: number;
  /** Epoch ms when the rest ends (running) — the extension counts down on its own. */
  endMs: number;
  /** Static remaining time, shown while paused. */
  remainingText: string;
  /** 0–1 share of the rest already done, shown while paused. */
  pausedProgress: number;
};

type RestLiveActivityNativeModule = {
  isSupported(): boolean;
  start(props: RestLiveActivityNativeProps): Promise<boolean>;
  update(props: RestLiveActivityNativeProps): Promise<boolean>;
  end(): Promise<void>;
};

/**
 * Null on Android, web and in binaries built before the module existed (older
 * dev clients / store builds receiving an update) — the feature is then off.
 */
const native: RestLiveActivityNativeModule | null =
  Platform.OS === 'ios'
    ? requireOptionalNativeModule<RestLiveActivityNativeModule>('RestLiveActivity')
    : null;

export function isRestLiveActivityAvailable(): boolean {
  if (!native) {
    return false;
  }
  try {
    return native.isSupported();
  } catch {
    return false;
  }
}

export async function startRestLiveActivity(props: RestLiveActivityNativeProps): Promise<boolean> {
  if (!native) {
    return false;
  }
  try {
    return await native.start(props);
  } catch {
    return false;
  }
}

export async function updateRestLiveActivity(props: RestLiveActivityNativeProps): Promise<boolean> {
  if (!native) {
    return false;
  }
  try {
    return await native.update(props);
  } catch {
    return false;
  }
}

export async function endRestLiveActivity(): Promise<void> {
  if (!native) {
    return;
  }
  try {
    await native.end();
  } catch {
    // Nothing to clean up on the JS side.
  }
}
