import { Stack } from 'expo-router';

import { HomeContent } from '@/features/home/home-content';
import { useGreeting } from '@/features/home/use-greeting';

/**
 * Home route. Deliberately thin: zero `Host` here, the whole screen is one
 * platform-split island that owns its own Host on iOS and returns Host-less RN
 * on Android.
 *
 * The greeting *is* the title. A nav title of "Home" above a "Good Evening"
 * heading said the same thing twice; Apple's own Home app ships the greeting as
 * the large title, so it lives in the navigation stack and never in the body.
 * `useGreeting` keeps it honest across 12:00/18:00 and across an overnight
 * background/resume instead of freezing at whatever the first render saw.
 */
export default function Home() {
  const greeting = useGreeting();

  return (
    <>
      <HomeContent />
      <Stack.Screen.Title large>{greeting}</Stack.Screen.Title>
    </>
  );
}
