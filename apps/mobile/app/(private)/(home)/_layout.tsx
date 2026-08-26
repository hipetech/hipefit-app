import { Stack } from 'expo-router';

/**
 * Native stack for the Home tab. Screens supply their own
 * `Stack.Screen.Title` / `Stack.Toolbar`, so this only establishes the stack.
 */
export default function HomeLayout() {
  return <Stack />;
}
