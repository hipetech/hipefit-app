import { useUserStore } from '@/stores/use-user-store';

/**
 * Resolves the app's active color scheme from the user's saved preference.
 *
 * Reads `profile.settings.theme` (`'system' | 'light' | 'dark'`) from the user
 * store and maps it to a value suitable for `Host.colorScheme` and the RN
 * `StatusBar`:
 * - `'light'` / `'dark'` → force that scheme
 * - `'system'` (or no profile yet) → `undefined`, i.e. follow the device
 *
 * This replaces the old `Uniwind.setTheme` mechanism.
 */
export const useAppColorScheme = (): 'light' | 'dark' | undefined => {
  const theme = useUserStore((s) => s.profile?.settings?.theme);
  return theme === 'light' || theme === 'dark' ? theme : undefined;
};
