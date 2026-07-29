import { StyleSheet } from 'react-native';

import { colors } from '@/theme/colors';

/**
 * Shared React Native layout styles.
 *
 * `groupedScreen` encodes the rule that `systemGroupedBackground` — *not*
 * `systemBackground` — is the correct backdrop behind `insetGrouped` rows. That
 * rule is currently re-decided in five separate files; naming it once means the
 * next grouped screen inherits the right answer instead of guessing.
 *
 * `StyleSheet.create` is an identity function (it only freezes entries in
 * `__DEV__`), so the `Color.ios.*` tokens stored here still resolve against the
 * active light/dark trait at render time.
 */
export const layout = StyleSheet.create({
  /** Page background for a screen whose content is a grouped `List`. */
  groupedScreen: {
    flex: 1,
    backgroundColor: colors.systemGroupedBackground,
  },
  /** Full-screen centering wrapper — loading and empty states. */
  centeredScreen: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.systemBackground,
  },
});
