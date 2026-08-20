import type { UserProfile } from '@/database';
import type { User } from '@react-native-firebase/auth';
import {
  getAuth,
  OAuthProvider,
  onAuthStateChanged,
  signInWithCredential,
  signOut,
} from '@react-native-firebase/auth';
import {
  getDoc,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
} from '@react-native-firebase/firestore';
import * as AppleAuthentication from 'expo-apple-authentication';
import { create } from 'zustand';

import { assertUserProfileWrite, decodeUserProfile, userRef } from '@/database';

interface AuthState {
  user: User | null;
  isLoading: boolean;
  isLoggedIn: boolean;
  initialize: () => () => void;
  signInWithApple: () => Promise<void>;
  signOut: () => Promise<void>;
}

interface AppleName {
  firstName: string | null;
  lastName: string | null;
}

const CURRENT_SCHEMA_VERSION = 1;
const noAppleName: AppleName = { firstName: null, lastName: null };

const buildDisplayName = (
  firstName: string | null,
  lastName: string | null
): string => [firstName, lastName].filter(Boolean).join(' ');

const createUserProfile = async (
  firebaseUser: User,
  appleName: AppleName
): Promise<void> => {
  const firstName = appleName.firstName ?? '';
  const lastName = appleName.lastName ?? '';
  const displayName =
    buildDisplayName(appleName.firstName, appleName.lastName) ||
    firebaseUser.displayName ||
    '';
  const validationTimestamp = Timestamp.now();
  const profile: UserProfile = {
    firstName,
    lastName,
    displayName,
    email: firebaseUser.email ?? null,
    photoURL: firebaseUser.photoURL ?? null,
    body: {
      birthDate: null,
      heightCm: null,
    },
    purpose: null,
    settings: {
      theme: 'system',
      language: 'en',
      units: 'metric',
      hiddenExerciseRefs: [],
      hiddenCategoryRefs: [],
    },
    schemaVersion: CURRENT_SCHEMA_VERSION,
    createdAt: validationTimestamp,
    updatedAt: validationTimestamp,
  };
  assertUserProfileWrite(profile);

  const now = serverTimestamp();
  await setDoc(userRef(firebaseUser.uid), {
    ...profile,
    createdAt: now,
    updatedAt: now,
  });
};

const ensureUserProfile = async (
  firebaseUser: User,
  appleName: AppleName
): Promise<void> => {
  const reference = userRef(firebaseUser.uid);
  const snapshot = await getDoc(reference);

  if (!snapshot.exists()) {
    await createUserProfile(firebaseUser, appleName);
    return;
  }

  let data = snapshot.data({ serverTimestamps: 'previous' });
  if (snapshot.metadata.hasPendingWrites) {
    const pendingTimestamp = Timestamp.now();
    data = {
      ...data,
      createdAt: data.createdAt ?? pendingTimestamp,
      updatedAt: data.updatedAt ?? pendingTimestamp,
    };
  }
  const profile = decodeUserProfile(data);
  if (!profile) {
    throw new Error('Existing user profile is malformed');
  }

  const updates: Record<string, unknown> = {};
  let firstName = profile.firstName;
  let lastName = profile.lastName;
  if (!firstName && appleName.firstName) {
    firstName = appleName.firstName;
    updates.firstName = firstName;
  }
  if (!lastName && appleName.lastName) {
    lastName = appleName.lastName;
    updates.lastName = lastName;
  }
  let displayName = profile.displayName;
  if (!displayName.trim()) {
    const appleDisplayName = buildDisplayName(firstName, lastName);
    if (appleDisplayName) {
      displayName = appleDisplayName;
      updates.displayName = displayName;
    }
  }
  const schemaVersion =
    profile.schemaVersion < CURRENT_SCHEMA_VERSION
      ? CURRENT_SCHEMA_VERSION
      : profile.schemaVersion;
  if (schemaVersion !== profile.schemaVersion) {
    updates.schemaVersion = schemaVersion;
  }
  if (Object.keys(updates).length === 0) return;

  assertUserProfileWrite({
    ...profile,
    firstName,
    lastName,
    displayName,
    schemaVersion,
    updatedAt: profile.updatedAt,
  });
  await updateDoc(reference, {
    ...updates,
    updatedAt: serverTimestamp(),
  });
};

export const useAuthStore = create<AuthState>((set) => {
  let unsubscribe: (() => void) | null = null;
  let authChangeSequence = 0;
  let pendingAppleName: AppleName | null = null;
  const profileEnsures = new Map<string, Promise<void>>();

  const ensureProfileOnce = (
    user: User,
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

    unsubscribe = onAuthStateChanged(getAuth(), (user) => {
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

      const appleName: AppleName = {
        firstName: credential.fullName?.givenName ?? null,
        lastName: credential.fullName?.familyName ?? null,
      };
      pendingAppleName = appleName;

      const provider = new OAuthProvider('apple.com');
      const appleCredential = provider.credential({
        idToken: credential.identityToken,
      });
      const { user } = await signInWithCredential(getAuth(), appleCredential);
      const sequence = ++authChangeSequence;
      set({ user: null, isLoggedIn: false, isLoading: true });
      try {
        await ensureProfileOnce(user, appleName);
        if (sequence === authChangeSequence) {
          set({ user, isLoggedIn: true, isLoading: false });
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
