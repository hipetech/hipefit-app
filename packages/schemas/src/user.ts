import type { Locale, Ref, Timestamp } from './shared';

export interface Body {
  birthDate: string | null;
  heightCm: number | null;
}

export interface UserSettings {
  theme: 'light' | 'dark' | 'system';
  language: Locale;
  units: 'metric' | 'imperial';
  hiddenExerciseRefs: Ref[];
  hiddenCategoryRefs: Ref[];
}

export interface UserProfile {
  firstName: string;
  lastName: string;
  displayName: string;
  email: string | null;
  photoURL: string | null;
  body: Body;
  purpose: string | null;
  settings: UserSettings;
  schemaVersion: number;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface BodyMeasurement {
  recordedAt: Timestamp;
  weightKg: number;
  note?: string;
}

export {
  assertBodyMeasurementWrite,
  assertUserProfileWrite,
  decodeBodyMeasurement,
  decodeUserProfile,
} from './validation';
