import type { ExerciseGroupSeed } from '../types';

export const exerciseGroups: Record<string, ExerciseGroupSeed> = {
  chest: { name: 'Chest', order: 1, icon: null },
  back: { name: 'Back', order: 2, icon: null },
  shoulders: { name: 'Shoulders', order: 3, icon: null },
  arms: { name: 'Arms', order: 4, icon: null },
  legs: { name: 'Legs', order: 5, icon: null },
  core: { name: 'Core', order: 6, icon: null },
  cardio: { name: 'Cardio', order: 7, icon: null },
  fullBody: { name: 'Full Body', order: 8, icon: null },
};
