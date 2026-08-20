import type { Timestamp } from '@react-native-firebase/firestore';

export type { Timestamp };

export type Locale = 'en' | 'uk';
export type GlobalLocalizedText = { en: string } & Partial<
  Record<Locale, string>
>;
export type UserLocalizedText = Partial<Record<Locale, string>>;
export type Ref = `global:${string}` | `custom:${string}`;

export type ExerciseType = 'strength' | 'cardio' | 'bodyweight';
export type WorkoutStatus = 'in_progress' | 'completed' | 'abandoned';

export interface WithId<T> {
  id: string;
  data: T;
}

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

export interface ExerciseCategory {
  name: GlobalLocalizedText;
  order: number;
  icon: string;
  isRetired: boolean;
}

export interface Equipment {
  name: GlobalLocalizedText;
  icon: string | null;
  isRetired: boolean;
}

export interface Exercise {
  categoryRef: Ref;
  name: GlobalLocalizedText;
  description: GlobalLocalizedText;
  type: ExerciseType;
  equipment: Ref[];
  imageURL: string | null;
  isRetired: boolean;
}

export interface CustomExerciseCategory {
  name: UserLocalizedText;
  defaultLocale: Locale;
  order: number;
  icon: string | null;
  isArchived: boolean;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface CustomExercise {
  categoryRef: Ref;
  forkedFromRef: Ref | null;
  name: UserLocalizedText;
  description: UserLocalizedText;
  defaultLocale: Locale;
  type: ExerciseType;
  equipment: Ref[];
  imageURL: string | null;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface TemplateSet {
  weight?: number;
  reps?: number;
  duration?: number;
  distance?: number;
}

export interface TemplateExercise {
  exerciseRef: Ref;
  nameSnapshot: string;
  type: ExerciseType;
  sets: TemplateSet[];
}

export interface WorkoutTemplate {
  name: string;
  description: string | null;
  exercises: TemplateExercise[];
  estimatedDuration: number | null;
  isArchived: boolean;
  lastPerformedAt: Timestamp | null;
  timesPerformed: number;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface WorkoutSet {
  isCompleted: boolean;
  weight?: number;
  reps?: number;
  duration?: number;
  distance?: number;
  rpe?: number;
  notes?: string;
}

export interface WorkoutExercise {
  exerciseRef: Ref;
  nameSnapshot: string;
  type: ExerciseType;
  sets: WorkoutSet[];
}

export interface Workout {
  templateRef: Ref | null;
  templateName: string | null;
  status: WorkoutStatus;
  startedAt: Timestamp;
  completedAt: Timestamp | null;
  activeSeconds: number | null;
  localDate: string;
  timeZone: string;
  bodyweightKg: number | null;
  notes: string | null;
  exercises: WorkoutExercise[];
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface BodyMeasurement {
  recordedAt: Timestamp;
  weightKg: number;
  note?: string;
}
