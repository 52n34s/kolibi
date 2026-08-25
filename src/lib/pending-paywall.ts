let pendingPaywallAfterSignup = false;

export function requestPaywallAfterSignup(): void {
  pendingPaywallAfterSignup = true;
}

export function consumePaywallAfterSignup(): boolean {
  const pending = pendingPaywallAfterSignup;
  pendingPaywallAfterSignup = false;
  return pending;
}
