/**
 * Kolibi is light-only. Always report light so themed helpers and future
 * components do not inherit the system dark-mode setting.
 */
export function useColorScheme(): 'light' {
  return 'light';
}
