import { Stack } from 'expo-router';

import { SettingsContent } from '@/features/settings/settings-content';

/**
 * Settings route. Deliberately thin: zero `Host` here, the whole screen is one
 * platform-split island that owns its own Host on iOS and returns Host-less RN
 * on Android. The title lives in the navigation stack, never in the body.
 */
export default function Settings() {
  return (
    <>
      <SettingsContent />
      <Stack.Screen.Title large>Settings</Stack.Screen.Title>
    </>
  );
}
