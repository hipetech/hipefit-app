import type { UserProfile } from '@/types/firestore';
import {
  AppleAuthProvider,
  FirebaseAuthTypes,
  getAuth,
  onAuthStateChanged,
  signInWithCredential,
  signOut,
} from '@react-native-firebase/auth';
import {
  doc,
  getDoc,
  getDocs,
  getFirestore,
  serverTimestamp,
  writeBatch,
} from '@react-native-firebase/firestore';
import * as AppleAuthentication from 'expo-apple-authentication';
import { create } from 'zustand';

import { globalGroupsRef, userRef } from '@/lib/firestore';

type User = FirebaseAuthTypes.User;

interface AuthState {
  user: User | null;
  isLoading: boolean;
  isLoggedIn: boolean;
  initialize: () => () => void;
  signInWithApple: () => Promise<void>;
  signOut: () => Promise<void>;
}

const createUserProfile = async (firebaseUser: User): Promise<void> => {
  const db = getFirestore();
  const batch = writeBatch(db);
  const uid = firebaseUser.uid;
  const now = serverTimestamp();

  // 1. Create user profile document
  const profileData: Omit<UserProfile, 'createdAt' | 'updatedAt'> & {
    createdAt: ReturnType<typeof serverTimestamp>;
    updatedAt: ReturnType<typeof serverTimestamp>;
  } = {
    displayName: firebaseUser.displayName ?? '',
    email: firebaseUser.email ?? null,
    photoURL: firebaseUser.photoURL ?? null,
    settings: {
      units: 'metric',
      theme: 'system',
      language: 'en',
      notificationsEnabled: true,
      workoutRemindersEnabled: false,
      autoPauseEnabled: true,
    },
    stats: {
      totalWorkouts: 0,
      currentStreak: 0,
      longestStreak: 0,
      lastWorkoutAt: null,
    },
    createdAt: now,
    updatedAt: now,
  };

  batch.set(userRef(uid), profileData);

  // 2. Seed default exercise groups from global collection
  const globalGroupsSnapshot = await getDocs(globalGroupsRef());

  for (const groupDoc of globalGroupsSnapshot.docs) {
    const groupData = groupDoc.data();
    const userGroupRef = doc(db, 'users', uid, 'exerciseGroups', groupDoc.id);

    batch.set(userGroupRef, {
      name: groupData.name,
      order: groupData.order,
      icon: groupData.icon ?? null,
      isDefault: true,
      globalGroupId: groupDoc.id,
      createdAt: now,
      updatedAt: now,
    });
  }

  await batch.commit();
};

const ensureUserProfile = async (firebaseUser: User): Promise<void> => {
  try {
    const userDocSnap = await getDoc(userRef(firebaseUser.uid));

    if (!userDocSnap.exists()) {
      await createUserProfile(firebaseUser);
    }
  } catch (error) {
    console.error('Error ensuring user profile:', error);
  }
};

export const useAuthStore = create<AuthState>((set) => {
  let unsubscribe: (() => void) | null = null;

  const initialize = () => {
    const auth = getAuth();
    unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        await ensureUserProfile(user);
      }

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
