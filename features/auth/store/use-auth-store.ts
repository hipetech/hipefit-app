import type { UserProfile } from '@/database';
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
  updateDoc,
  writeBatch,
} from '@react-native-firebase/firestore';
import * as AppleAuthentication from 'expo-apple-authentication';
import { create } from 'zustand';

import { globalGroupsRef, userRef } from '@/database';

type User = FirebaseAuthTypes.User;

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

const buildDisplayName = (
  firstName: string | null,
  lastName: string | null
): string => {
  return [firstName, lastName].filter(Boolean).join(' ');
};

const createUserProfile = async (
  firebaseUser: User,
  appleName: AppleName
): Promise<void> => {
  const db = getFirestore();
  const batch = writeBatch(db);
  const uid = firebaseUser.uid;
  const now = serverTimestamp();

  const firstName = appleName.firstName ?? '';
  const lastName = appleName.lastName ?? '';
  const displayName =
    buildDisplayName(appleName.firstName, appleName.lastName) ||
    firebaseUser.displayName ||
    '';

  const profileData: Omit<UserProfile, 'createdAt' | 'updatedAt'> & {
    createdAt: ReturnType<typeof serverTimestamp>;
    updatedAt: ReturnType<typeof serverTimestamp>;
  } = {
    firstName,
    lastName,
    displayName,
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

  // Seed default exercise groups from global collection
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

const ensureUserProfile = async (
  firebaseUser: User,
  appleName: AppleName
): Promise<void> => {
  const userDocSnap = await getDoc(userRef(firebaseUser.uid));

  if (!userDocSnap.exists()) {
    await createUserProfile(firebaseUser, appleName);
  } else if (appleName.firstName || appleName.lastName) {
    const updates: Record<string, unknown> = {
      updatedAt: serverTimestamp(),
    };
    if (appleName.firstName) updates.firstName = appleName.firstName;
    if (appleName.lastName) updates.lastName = appleName.lastName;
    updates.displayName = buildDisplayName(
      appleName.firstName,
      appleName.lastName
    );
    await updateDoc(userRef(firebaseUser.uid), updates);
  }
};

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

      const appleName: AppleName = {
        firstName: credential.fullName?.givenName ?? null,
        lastName: credential.fullName?.familyName ?? null,
      };

      const appleCredential = AppleAuthProvider.credential(
        credential.identityToken,
        undefined
      );

      const { user } = await signInWithCredential(getAuth(), appleCredential);
      await ensureUserProfile(user, appleName);
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
