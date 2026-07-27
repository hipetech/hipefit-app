import { Stack } from 'expo-router';

/**
 * Native stack for the Exercises tab. Screens supply their own
 * `Stack.Screen.Title` / `Stack.SearchBar`, so this only establishes the stack.
 */
export default function ExercisesLayout() {
  return <Stack />;
}
