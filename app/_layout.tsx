import { useEffect } from 'react';
import { View } from 'react-native';
import { Stack } from 'expo-router';
import { HeroUINativeProvider } from 'heroui-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { Uniwind } from 'uniwind';

import '../global.css';

import * as SplashScreen from 'expo-splash-screen';

import { useFirestoreSubscriptions } from '@/database/use-firestore-subscriptions';
import { useAuthStore } from '@/features/auth/store/use-auth-store';
import { useUserStore } from '@/features/user/store/use-user-store';

SplashScreen.setOptions({
  duration: 500,
  fade: true,
});

export default function RootLayout() {
  const { isLoggedIn, isLoading, initialize } = useAuthStore();
  const theme = useUserStore((s) => s.profile?.settings?.theme);
  useFirestoreSubscriptions();

  useEffect(() => {
    const cleanup = initialize();
    return cleanup;
  }, [initialize]);

  useEffect(() => {
    if (theme) {
      Uniwind.setTheme(theme);
    }
  }, [theme]);

  if (isLoading) {
    return (
      <View className="bg-background flex-1 items-center justify-center">
        {/* Loading state */}
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <HeroUINativeProvider>
        <Stack>
          <Stack.Screen name="index" options={{ headerShown: false }} />
          <Stack.Screen
            name="(public)/login"
            options={{ headerShown: false }}
          />
          <Stack.Protected guard={isLoggedIn}>
            <Stack.Screen name="(private)" options={{ headerShown: false }} />
          </Stack.Protected>
        </Stack>
      </HeroUINativeProvider>
    </GestureHandlerRootView>
  );
}
