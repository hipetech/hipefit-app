import { Stack } from 'expo-router';

/**
 * Native stack for the Workouts tab. Screens supply their own
 * `Stack.Screen.Title` / `Stack.Toolbar`, so this only establishes the stack.
 */
export default function WorkoutsLayout() {
  return <Stack />;
}
