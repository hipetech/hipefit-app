import { useEffect } from 'react';
import { Platform, View } from 'react-native';
import { Button, Host } from '@expo/ui';
import * as AppleAuthentication from 'expo-apple-authentication';

import { useAppColorScheme } from '@/hooks/use-app-color-scheme';
import { colors } from '@/theme/colors';
import { Text } from '@/ui/text';

import { useAuthStore } from './store/use-auth-store';

export function AuthScreen() {
  const { isLoading, isLoggedIn, initialize, signInWithApple, signOut } =
    useAuthStore();
  const colorScheme = useAppColorScheme();

  useEffect(() => {
    const cleanup = initialize();
    return cleanup;
  }, [initialize]);

  const handleSignIn = async () => {
    try {
      await signInWithApple();
    } catch {
      // Error is already logged in the store
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut();
    } catch {
      // Error is already logged in the store
    }
  };

  if (isLoading) {
    return (
      <View
        style={{
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: colors.systemBackground,
        }}
      >
        <Text>Loading...</Text>
      </View>
    );
  }

  return (
    <View
      style={{
        flex: 1,
        padding: 16,
        backgroundColor: colors.systemBackground,
      }}
    >
      <View
        style={{
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          gap: 16,
        }}
      >
        {/* Mirrors SwiftUI `.font(.title2).bold()`: the variant supplies the
            Apple metrics, the weight is the emphasis modifier on top. */}
        <Text variant="title2" style={{ fontWeight: '700' }}>
          {isLoggedIn ? 'Logged In' : 'Not Logged In'}
        </Text>

        {Platform.OS === 'ios' &&
          (isLoggedIn ? (
            <Host matchContents colorScheme={colorScheme}>
              <Button variant="filled" onPress={handleSignOut}>
                Sign Out
              </Button>
            </Host>
          ) : (
            <View style={{ width: '100%', maxWidth: 320 }}>
              <AppleAuthentication.AppleAuthenticationButton
                buttonType={
                  AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN
                }
                buttonStyle={
                  AppleAuthentication.AppleAuthenticationButtonStyle.WHITE
                }
                cornerRadius={8}
                style={{
                  width: '100%',
                  height: 50,
                }}
                onPress={handleSignIn}
              />
            </View>
          ))}
      </View>
    </View>
  );
}
