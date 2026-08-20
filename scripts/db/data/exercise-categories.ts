import type { ExerciseCategorySeed } from '../types';

export const exerciseCategories: ExerciseCategorySeed[] = [
  {
    slug: 'chest',
    name: { en: 'Chest', uk: 'Груди' },
    order: 1,
    icon: 'figure.strengthtraining.traditional',
    isRetired: false,
  },
  {
    slug: 'back',
    name: { en: 'Back', uk: 'Спина' },
    order: 2,
    icon: 'figure.rower',
    isRetired: false,
  },
  {
    slug: 'shoulders',
    name: { en: 'Shoulders', uk: 'Плечі' },
    order: 3,
    icon: 'figure.arms.open',
    isRetired: false,
  },
  {
    slug: 'arms',
    name: { en: 'Arms', uk: 'Руки' },
    order: 4,
    icon: 'dumbbell.fill',
    isRetired: false,
  },
  {
    slug: 'legs',
    name: { en: 'Legs', uk: 'Ноги' },
    order: 5,
    icon: 'figure.walk',
    isRetired: false,
  },
  {
    slug: 'core',
    name: { en: 'Core', uk: 'Корпус' },
    order: 6,
    icon: 'figure.core.training',
    isRetired: false,
  },
  {
    slug: 'cardio',
    name: { en: 'Cardio', uk: 'Кардіо' },
    order: 7,
    icon: 'heart.fill',
    isRetired: false,
  },
  {
    slug: 'full-body',
    name: { en: 'Full Body', uk: 'Усе тіло' },
    order: 8,
    icon: 'figure.mixed.cardio',
    isRetired: false,
  },
];
