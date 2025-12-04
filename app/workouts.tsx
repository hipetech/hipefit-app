import { useEffect, useState } from 'react';
import { Platform, View } from 'react-native';
import {
  AppleAuthProvider,
  getAuth,
  onAuthStateChanged,
  signInWithCredential,
} from '@react-native-firebase/auth';
import * as AppleAuthentication from 'expo-apple-authentication';

import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';

export default function Workouts() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Check initial auth state
    const unsubscribe = onAuthStateChanged(getAuth(), (user) => {
      setIsLoggedIn(!!user);
      setIsLoading(false);
    });

    return unsubscribe;
  }, []);

  const signInWithApple = async () => {
    try {
      if (Platform.OS !== 'ios') {
        console.warn('Apple Authentication is only available on iOS');
        return;
      }

      // Check if Apple Authentication is available
      const isAvailable = await AppleAuthentication.isAvailableAsync();
      if (!isAvailable) {
        console.warn('Apple Authentication is not available on this device');
        return;
      }

      // Request Apple authentication
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });

      // Ensure Apple returned a user identityToken
      if (!credential.identityToken) {
        throw new Error('Apple Sign-In failed - no identity token returned');
      }

      // Create a Firebase credential from the response
      // Note: Expo's Apple Authentication doesn't provide nonce, so we pass undefined
      const appleCredential = AppleAuthProvider.credential(
        credential.identityToken,
        undefined
      );

      // Sign the user in with the credential
      await signInWithCredential(getAuth(), appleCredential);
    } catch (error: any) {
      if (error.code === 'ERR_REQUEST_CANCELED') {
        console.log('User canceled Apple Sign-In');
      } else {
        console.error('Apple Sign-In Error:', error);
      }
    }
  };

  const signOut = async () => {
    try {
      await getAuth().signOut();
    } catch (error) {
      console.error('Sign out error:', error);
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
              <Button onPress={signOut} className="w-full">
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
                onPress={signInWithApple}
              />
            )}
          </View>
        )}
      </View>
    </View>
  );
}
