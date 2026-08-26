import { Stack } from 'expo-router';

/**
 * Native stack for the Settings tab. Screens supply their own
 * `Stack.Screen.Title` / `Stack.Toolbar`; this only establishes the stack and
 * declares the presentation of the Edit Profile form sheet.
 */
export default function SettingsLayout() {
  return (
    <Stack>
      <Stack.Screen name="index" />
      <Stack.Screen
        name="edit-profile"
        options={{
          presentation: 'formSheet',
          sheetGrabberVisible: true,
          sheetAllowedDetents: [0.45, 0.9],
          sheetCornerRadius: 20,
        }}
      />
    </Stack>
  );
}
