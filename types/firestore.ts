import { FirebaseFirestoreTypes } from '@react-native-firebase/firestore';

type Timestamp = FirebaseFirestoreTypes.Timestamp;

// ─── Shared Type Aliases ────────────────────────────────────────────────────

export type ExerciseType = 'strength' | 'cardio' | 'bodyweight';
export type Difficulty = 'beginner' | 'intermediate' | 'advanced';
export type WorkoutStatus = 'in_progress' | 'completed' | 'abandoned';

// ─── Utility ────────────────────────────────────────────────────────────────

export interface WithId<T> {
  id: string;
  data: T;
}

// ─── Exercise Groups ────────────────────────────────────────────────────────

/** Global default exercise group (read-only) */
export interface ExerciseGroup {
  name: string;
  order: number;
  icon: string | null;
}

/** User's exercise group (seeded from defaults, fully editable) */
export interface UserExerciseGroup {
  name: string;
  order: number;
  icon: string | null;
  isDefault: boolean;
  globalGroupId: string | null;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// ─── Exercises ──────────────────────────────────────────────────────────────

/** Global default exercise (read-only) */
export interface Exercise {
  name: string;
  description: string;
  type: ExerciseType;
  groupKey: string;
  equipment: string[];
  difficulty: Difficulty;
  imageURL: string | null;
  createdAt: Timestamp;
}

/** Sparse user overrides on a global exercise */
export interface ExerciseOverride {
  name: string | null;
  description: string | null;
  groupId: string | null;
  isHidden: boolean;
  updatedAt: Timestamp;
}

/** User-created exercise */
export interface CustomExercise {
  name: string;
  description: string;
  type: ExerciseType;
  groupId: string;
  equipment: string[];
  difficulty: Difficulty;
  imageURL: string | null;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// ─── User Profile ───────────────────────────────────────────────────────────

export interface UserSettings {
  units: 'metric' | 'imperial';
  theme: 'light' | 'dark' | 'system';
  language: string;
  notificationsEnabled: boolean;
  workoutRemindersEnabled: boolean;
  autoPauseEnabled: boolean;
}

export interface UserStats {
  totalWorkouts: number;
  currentStreak: number;
  longestStreak: number;
  lastWorkoutAt: Timestamp | null;
}

export interface UserProfile {
  displayName: string;
  email: string | null;
  photoURL: string | null;
  settings: UserSettings;
  stats: UserStats;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// ─── Routines ───────────────────────────────────────────────────────────────

export interface RoutineSet {
  setNumber: number;
  targetWeight?: number;
  targetReps?: number;
  targetDuration?: number;
  targetDistance?: number;
}

export interface RoutineExercise {
  exerciseId: string;
  exerciseName: string;
  exerciseType: ExerciseType;
  isCustom: boolean;
  order: number;
  sets: RoutineSet[];
}

export interface Routine {
  name: string;
  description: string | null;
  exercises: RoutineExercise[];
  estimatedDuration: number | null;
  isArchived: boolean;
  lastPerformedAt: Timestamp | null;
  timesPerformed: number;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// ─── Workouts ───────────────────────────────────────────────────────────────

export interface WorkoutSet {
  setNumber: number;
  isCompleted: boolean;
  weight?: number;
  reps?: number;
  duration?: number;
  distance?: number;
  rpe?: number;
  notes?: string;
}

export interface WorkoutExercise {
  exerciseId: string;
  exerciseName: string;
  exerciseType: ExerciseType;
  isCustom: boolean;
  order: number;
  sets: WorkoutSet[];
}

export interface Workout {
  routineId: string | null;
  routineName: string | null;
  status: WorkoutStatus;
  startedAt: Timestamp;
  completedAt: Timestamp | null;
  duration: number | null;
  notes: string | null;
  exercises: WorkoutExercise[];
  totalVolume: number | null;
  totalSets: number;
  totalExercises: number;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// ─── Exercise History ───────────────────────────────────────────────────────

export interface BestSet {
  weight?: number;
  reps?: number;
  duration?: number;
  distance?: number;
  volume?: number;
}

export interface ExerciseHistoryEntry {
  exerciseId: string;
  isCustom: boolean;
  exerciseName: string;
  exerciseType: ExerciseType;
  workoutId: string;
  performedAt: Timestamp;
  sets: WorkoutSet[];
  bestSet: BestSet;
  totalVolume: number | null;
  createdAt: Timestamp;
}
