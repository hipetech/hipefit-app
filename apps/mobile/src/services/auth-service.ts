import type { UserProfile } from '@hipefit/schemas';
import type { User } from '@react-native-firebase/auth';
import { getFirebaseAuth, userRef } from '@hipefit/firebase/react-native';
import { assertUserProfileWrite, decodeUserProfile } from '@hipefit/schemas';
import {
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

export type AuthUser = User;

export interface AppleName {
  firstName: string | null;
  lastName: string | null;
}

export interface AppleSignInResult {
  user: User;
  appleName: AppleName;
}

const CURRENT_SCHEMA_VERSION = 1;

export const noAppleName: AppleName = { firstName: null, lastName: null };

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

export const ensureUserProfile = async (
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

export const subscribeToAuth = (
  listener: (user: User | null) => void
): (() => void) => onAuthStateChanged(getFirebaseAuth(), listener);

export const signInWithAppleAccount = async (
  onAppleName: (appleName: AppleName) => void
): Promise<AppleSignInResult | null> => {
  const isAvailable = await AppleAuthentication.isAvailableAsync();
  if (!isAvailable) {
    console.warn('Apple Authentication is not available on this device');
    return null;
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
  onAppleName(appleName);
  const provider = new OAuthProvider('apple.com');
  const appleCredential = provider.credential({
    idToken: credential.identityToken,
  });
  const { user } = await signInWithCredential(
    getFirebaseAuth(),
    appleCredential
  );
  return { user, appleName };
};

export const signOutCurrentUser = async (): Promise<void> =>
  signOut(getFirebaseAuth());
