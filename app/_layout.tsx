import { useEffect } from 'react';
import { View } from 'react-native';
import { PortalHost } from '@rn-primitives/portal';
import { Stack } from 'expo-router';

import '../global.css';

import * as SplashScreen from 'expo-splash-screen';

import { useAuthStore } from '@/features/auth/store/use-auth-store';

SplashScreen.setOptions({
  duration: 500,
  fade: true,
});

export default function RootLayout() {
  const { isLoggedIn, isLoading, initialize } = useAuthStore();

  useEffect(() => {
    const cleanup = initialize();
    return cleanup;
  }, [initialize]);

  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center bg-background">
        {/* Loading state */}
      </View>
    );
  }

  return (
    <>
      <Stack>
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="(public)/login" options={{ headerShown: false }} />
        <Stack.Protected guard={isLoggedIn}>
          <Stack.Screen name="(private)" options={{ headerShown: false }} />
        </Stack.Protected>
      </Stack>
      <PortalHost />
    </>
  );
}
