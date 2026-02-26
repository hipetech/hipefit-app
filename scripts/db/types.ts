export interface ExerciseGroupSeed {
  name: string;
  order: number;
  icon: string | null;
}

export interface ExerciseSeed {
  name: string;
  description: string;
  type: 'strength' | 'cardio' | 'bodyweight';
  groupKey: string;
  equipment: string[];
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  imageURL: string | null;
}

export interface SeedOptions {
  dryRun: boolean;
  clean: boolean;
  env: 'development' | 'staging' | 'production';
}
