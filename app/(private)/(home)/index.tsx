import { Stack } from 'expo-router';

import { HomeContent } from '@/features/home/home-content';

/**
 * Home route. The profile greeting is part of the screen body, so this route
 * hides the navigation header rather than repeating it with a title.
 */
export default function Home() {
  return (
    <>
      <HomeContent />
      <Stack.Screen options={{ headerShown: false }} />
    </>
  );
}
