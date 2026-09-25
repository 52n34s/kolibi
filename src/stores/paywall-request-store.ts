import { create } from 'zustand';

/**
 * App-wide paywall request. Screens without their own PaywallSheet (route
 * gate, training start) ask here; GlobalPaywallHost in the root layout shows it.
 */
type PaywallRequestState = {
  visible: boolean;
  withValuePitch: boolean;
  requestPaywall: (options?: { withValuePitch?: boolean }) => void;
  closePaywall: () => void;
};

export const usePaywallRequestStore = create<PaywallRequestState>((set) => ({
  visible: false,
  withValuePitch: true,
  requestPaywall: (options) =>
    set({ visible: true, withValuePitch: options?.withValuePitch ?? true }),
  closePaywall: () => set({ visible: false }),
}));
