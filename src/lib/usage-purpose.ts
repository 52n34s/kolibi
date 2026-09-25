/**
 * "Wofür nutzt du Kolibi?" — stored in profiles.usage_purpose once the
 * migration 20260926183200_profiles_usage_purpose ran, and on the device
 * until then (see onboarding-local-state).
 */

export type UsagePurpose = 'nutrition' | 'training' | 'both';

export const USAGE_PURPOSES = [
  'nutrition',
  'training',
  'both',
] as const satisfies readonly UsagePurpose[];

export function parseUsagePurpose(value: unknown): UsagePurpose | null {
  return value === 'nutrition' || value === 'training' || value === 'both' ? value : null;
}

export function usesTraining(purpose: UsagePurpose | null | undefined): boolean {
  return purpose === 'training' || purpose === 'both';
}
