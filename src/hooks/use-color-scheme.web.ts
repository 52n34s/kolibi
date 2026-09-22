/**
 * Kolibi is light-only (same as native). Kept as a named export so web bundling
 * resolves the platform file without following the system scheme.
 */
export function useColorScheme(): 'light' {
  return 'light';
}
