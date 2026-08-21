import type { AppleName, AuthUser } from '@/services/auth-service';
import { create } from 'zustand';

import {
  ensureUserProfile,
  noAppleName,
  signInWithAppleAccount,
  signOutCurrentUser,
  subscribeToAuth,
} from '@/services/auth-service';

interface AuthState {
  user: AuthUser | null;
  isLoading: boolean;
  isLoggedIn: boolean;
  initialize: () => () => void;
  signInWithApple: () => Promise<void>;
  signOut: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => {
  let unsubscribe: (() => void) | null = null;
  let authChangeSequence = 0;
  let pendingAppleName: AppleName | null = null;
  const profileEnsures = new Map<string, Promise<void>>();

  const ensureProfileOnce = (
    user: AuthUser,
    appleName: AppleName
  ): Promise<void> => {
    const existing = profileEnsures.get(user.uid);
    if (existing) return existing;

    const pending = ensureUserProfile(user, appleName).finally(() => {
      if (profileEnsures.get(user.uid) === pending) {
        profileEnsures.delete(user.uid);
      }
    });
    profileEnsures.set(user.uid, pending);
    return pending;
  };

  const initialize = () => {
    // The auth listener is app-lifetime and initialize has several callers.
    if (unsubscribe) return () => {};

    unsubscribe = subscribeToAuth((user) => {
      const sequence = ++authChangeSequence;
      if (!user) {
        set({ user: null, isLoggedIn: false, isLoading: false });
        return;
      }

      set({ user: null, isLoggedIn: false, isLoading: true });
      void ensureProfileOnce(user, pendingAppleName ?? noAppleName)
        .then(() => {
          if (sequence === authChangeSequence) {
            set({ user, isLoggedIn: true, isLoading: false });
          }
        })
        .catch((error: unknown) => {
          console.error('[AuthStore] ensure profile', error);
          if (sequence === authChangeSequence) {
            set({ user: null, isLoggedIn: false, isLoading: false });
          }
        });
    });

    return () => {
      authChangeSequence += 1;
      if (unsubscribe) {
        unsubscribe();
        unsubscribe = null;
      }
    };
  };

  const signInWithApple = async () => {
    try {
      const result = await signInWithAppleAccount((appleName) => {
        pendingAppleName = appleName;
      });
      if (!result) return;

      const sequence = ++authChangeSequence;
      set({ user: null, isLoggedIn: false, isLoading: true });
      try {
        await ensureProfileOnce(result.user, result.appleName);
        if (sequence === authChangeSequence) {
          set({ user: result.user, isLoggedIn: true, isLoading: false });
        }
      } catch (error) {
        if (sequence === authChangeSequence) {
          set({ user: null, isLoggedIn: false, isLoading: false });
        }
        throw error;
      }
    } catch (error) {
      const code =
        typeof error === 'object' && error !== null && 'code' in error
          ? (error as { code?: unknown }).code
          : undefined;

      if (code === 'ERR_REQUEST_CANCELED') {
        console.log('User canceled Apple Sign-In');
      } else {
        console.error('Apple Sign-In Error:', error);
      }
      throw error;
    } finally {
      pendingAppleName = null;
    }
  };

  const handleSignOut = async () => {
    try {
      await signOutCurrentUser();
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
