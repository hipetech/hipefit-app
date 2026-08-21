export type Environment = 'development' | 'staging' | 'production';

// Seed types are stricter authoring inputs; the seeder transforms and validates their persisted shapes.
export interface LocalizedTextSeed {
  en: string;
  uk: string;
}

export interface ExerciseCategorySeed {
  slug: string;
  name: LocalizedTextSeed;
  order: number;
  icon: string;
  isRetired: boolean;
}

export interface EquipmentSeed {
  slug: string;
  name: LocalizedTextSeed;
  icon: string | null;
  isRetired: boolean;
}

export interface ExerciseSeed {
  slug: string;
  name: LocalizedTextSeed;
  description: LocalizedTextSeed;
  type: 'strength' | 'cardio' | 'bodyweight';
  categoryRef: string;
  equipment: string[];
  imageURL: string | null;
  isRetired: boolean;
}

export interface SeedOptions {
  dryRun: boolean;
  clean: boolean;
  env: Environment;
  allowProductionClean: boolean;
}
