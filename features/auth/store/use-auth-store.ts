import {
  AppleAuthProvider,
  getAuth,
  onAuthStateChanged,
  signInWithCredential,
  signOut,
  User,
} from '@react-native-firebase/auth';
import * as AppleAuthentication from 'expo-apple-authentication';
import { create } from 'zustand';

interface AuthState {
  user: User | null;
  isLoading: boolean;
  isLoggedIn: boolean;
  initialize: () => () => void;
  signInWithApple: () => Promise<void>;
  signOut: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => {
  let unsubscribe: (() => void) | null = null;

  const initialize = () => {
    const auth = getAuth();
    unsubscribe = onAuthStateChanged(auth, (user) => {
      set({
        user,
        isLoggedIn: !!user,
        isLoading: false,
      });
    });

    return () => {
      if (unsubscribe) {
        unsubscribe();
        unsubscribe = null;
      }
    };
  };

  const signInWithApple = async () => {
    try {
      const isAvailable = await AppleAuthentication.isAvailableAsync();
      if (!isAvailable) {
        console.warn('Apple Authentication is not available on this device');
        return;
      }

      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });

      if (!credential.identityToken) {
        throw new Error('Apple Sign-In failed - no identity token returned');
      }

      const appleCredential = AppleAuthProvider.credential(
        credential.identityToken,
        undefined
      );

      await signInWithCredential(getAuth(), appleCredential);
    } catch (error: any) {
      if (error.code === 'ERR_REQUEST_CANCELED') {
        console.log('User canceled Apple Sign-In');
      } else {
        console.error('Apple Sign-In Error:', error);
      }
      throw error;
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut(getAuth());
    } catch (error) {
      console.error('Sign out error:', error);
      throw error;
    }
  };

  return {
    user: null,
    isLoading: true,
    isLoggedIn: false,
    initialize,
    signInWithApple,
    signOut: handleSignOut,
  };
});
