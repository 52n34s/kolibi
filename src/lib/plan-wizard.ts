import { usesTraining, type UsagePurpose } from '@/lib/usage-purpose';

/** Route of the training plan wizard (built in a separate block). */
export const PLAN_WIZARD_ROUTE = '/koli/plan-wizard';

/**
 * src/app/koli/plan-wizard.tsx is on release/1.4 (block 2.3). Set to false
 * to fall back to the "wizard pending" marker only.
 */
export const PLAN_WIZARD_AVAILABLE = true;

export type PostOnboardingWizardAction =
  /** Push the wizard right after /home. */
  | 'open_now'
  /** Start it the first time the training tab opens. */
  | 'pending_training_tab'
  | 'none';

/**
 * Training or Both → wizard right after the onboarding (skippable there).
 * Nutrition, no answer, or wizard not shipped yet → marker for the first
 * visit of the training tab. Review mode changes nothing.
 */
export function resolvePostOnboardingWizard(params: {
  purpose: UsagePurpose | null;
  wizardAvailable: boolean;
  isReviewMode: boolean;
}): PostOnboardingWizardAction {
  if (params.isReviewMode) {
    return 'none';
  }
  if (usesTraining(params.purpose) && params.wizardAvailable) {
    return 'open_now';
  }
  return 'pending_training_tab';
}
