import { useEffect } from 'react';
import { Appearance, StyleSheet, useColorScheme, View } from 'react-native';
import { Stack } from 'expo-router';
import {
  DarkTheme,
  DefaultTheme,
  ThemeProvider,
} from 'expo-router/react-navigation';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { useFirestoreSubscriptions } from '@/database/use-firestore-subscriptions';
import { useAuthStore } from '@/features/auth/store/use-auth-store';
import { useAppColorScheme } from '@/hooks/use-app-color-scheme';
import { colors } from '@/theme/colors';
import { layout } from '@/theme/styles';

SplashScreen.setOptions({
  duration: 500,
  fade: true,
});

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.systemBackground,
  },
});

export default function RootLayout() {
  const { isLoggedIn, isLoading, initialize } = useAuthStore();
  const scheme = useAppColorScheme();
  // Reflects whatever `Appearance.setColorScheme` resolved to below, so the
  // navigation chrome (large titles, toolbars) matches the rest of the app.
  const activeScheme = useColorScheme();
  useFirestoreSubscriptions();

  useEffect(() => {
    const cleanup = initialize();
    return cleanup;
  }, [initialize]);

  // Apply the user's theme preference app-wide so the semantic colors in
  // `@/theme/colors` (`Color.ios.*`) resolve against it. 'unspecified' =
  // follow the device (system) —
  // this replaces the former Uniwind.setTheme mechanism.
  useEffect(() => {
    Appearance.setColorScheme(scheme ?? 'unspecified');
  }, [scheme]);

  if (isLoading) {
    return <View style={layout.centeredScreen} />;
  }

  return (
    <GestureHandlerRootView style={styles.root}>
      <ThemeProvider value={activeScheme === 'dark' ? DarkTheme : DefaultTheme}>
        <StatusBar style="auto" />
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
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}
