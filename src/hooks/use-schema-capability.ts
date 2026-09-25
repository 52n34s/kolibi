import { useQuery } from '@tanstack/react-query';

import type { SchemaCapability } from '@/lib/workouts/schema-capabilities';
import { checkSchemaCapability } from '@/lib/workouts/workouts-api';

/**
 * True once the optional column behind `capability` is known to exist.
 * While unknown or offline the feature stays hidden; a missing column is
 * cached for the app run, transient errors retry.
 */
export function useSchemaCapability(capability: SchemaCapability): boolean {
  const query = useQuery({
    queryKey: ['schema-capability', capability],
    staleTime: Infinity,
    gcTime: Infinity,
    queryFn: () => checkSchemaCapability(capability),
  });
  return query.data === true;
}
