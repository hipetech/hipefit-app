import type { ExerciseType } from './exercise';
import type { Ref, Timestamp } from './shared';

export type WorkoutStatus = 'in_progress' | 'completed' | 'abandoned';

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

export {
  assertWorkoutTemplateWrite,
  assertWorkoutWrite,
  decodeWorkout,
  decodeWorkoutTemplate,
} from './validation';
