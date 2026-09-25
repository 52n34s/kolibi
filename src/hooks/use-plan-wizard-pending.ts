import { useCallback, useEffect, useState } from 'react';

import { isPlanWizardPending, setPlanWizardPending } from '@/lib/onboarding-local-state';
import { useAuthStore } from '@/stores/auth-store';

/**
 * Set by the onboarding when the plan wizard should start on the first visit
 * of the training tab (usage "Ernährung", no answer, or skipped onboarding).
 * The training tab reads `pending` and calls `clear()` once it started the
 * wizard (or the user dismissed it).
 */
export function usePlanWizardPending(): { pending: boolean; clear: () => void } {
  const userId = useAuthStore((state) => state.session?.user?.id);
  const [pending, setPending] = useState(() => (userId ? isPlanWizardPending(userId) : false));

  useEffect(() => {
    setPending(userId ? isPlanWizardPending(userId) : false);
  }, [userId]);

  const clear = useCallback(() => {
    if (userId) {
      setPlanWizardPending(userId, false);
    }
    setPending(false);
  }, [userId]);

  return { pending, clear };
}
