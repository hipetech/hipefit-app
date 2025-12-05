import { useEffect } from 'react';
import { Platform, View } from 'react-native';
import * as AppleAuthentication from 'expo-apple-authentication';

import { Button } from '@/ui/button';
import { Text } from '@/ui/text';

import { useAuthStore } from './store/use-auth-store';

export function AuthScreen() {
  const { isLoading, isLoggedIn, initialize, signInWithApple, signOut } =
    useAuthStore();

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
      <View className="flex-1 items-center justify-center bg-background">
        <Text>Loading...</Text>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-background p-4">
      <View className="flex-1 items-center justify-center gap-4">
        <Text className="text-2xl font-bold">
          {isLoggedIn ? 'Logged In' : 'Not Logged In'}
        </Text>

        {Platform.OS === 'ios' && (
          <View className="w-full max-w-xs">
            {isLoggedIn ? (
              <Button onPress={handleSignOut} className="w-full">
                <Text>Sign Out</Text>
              </Button>
            ) : (
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
            )}
          </View>
        )}
      </View>
    </View>
  );
}
