import { useQuery } from '@tanstack/react-query';

import { supabase } from '@/lib/supabase';

type FeatureFlagRow = {
  key: string;
  enabled: boolean;
};

export function useFeatureFlag(key: string) {
  return useQuery({
    queryKey: ['feature-flag', key],
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('feature_flags')
        .select('key, enabled')
        .eq('key', key)
        .maybeSingle<FeatureFlagRow>();

      if (error) {
        return false;
      }

      return data?.enabled ?? false;
    },
  });
}

