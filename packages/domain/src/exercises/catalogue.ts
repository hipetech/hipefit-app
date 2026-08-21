import type {
  CustomExercise,
  CustomExerciseCategory,
  Equipment,
  Exercise,
  ExerciseCategory,
  ExerciseType,
  Locale,
  Ref,
  UserSettings,
  WithId,
} from '@hipefit/schemas';

import { resolveGlobalText, resolveUserText } from './localization';

export interface MergedEquipment {
  id: string;
  ref: Ref;
  name: string;
  icon: string | null;
}

export interface MergedCategory {
  id: string;
  ref: Ref;
  isCustom: boolean;
  name: string;
  order: number;
  icon: string | null;
  isArchived: boolean;
  isRetired: boolean;
}

export interface MergedExercise {
  id: string;
  ref: Ref;
  isCustom: boolean;
  name: string;
  description: string;
  type: ExerciseType;
  categoryRef: Ref;
  categoryName: string;
  equipmentRefs: Ref[];
  equipment: string[];
  imageURL: string | null;
  isRetired: boolean;
}

export interface ExerciseCatalogueSource {
  globalExercises: WithId<Exercise>[];
  globalCategories: WithId<ExerciseCategory>[];
  equipment: WithId<Equipment>[];
  customExercises: WithId<CustomExercise>[];
  customCategories: WithId<CustomExerciseCategory>[];
}

export interface ExerciseCatalogue {
  exercises: MergedExercise[];
  categories: MergedCategory[];
  equipment: MergedEquipment[];
}

const globalIdPattern = /^[a-z0-9-]+$/;
const customIdPattern = /^[A-Za-z0-9_-]{1,64}$/;

const toRef = (id: string, scope: 'global' | 'custom'): Ref | null => {
  const pattern = scope === 'global' ? globalIdPattern : customIdPattern;
  if (!pattern.test(id)) {
    console.error(`[ExerciseStore] Dropped malformed ${scope} document ID`, id);
    return null;
  }
  return `${scope}:${id}`;
};

export const buildExerciseCatalogue = (
  raw: ExerciseCatalogueSource,
  settings: UserSettings
): ExerciseCatalogue => {
  const locale: Locale = settings.language;
  const hiddenExerciseRefs = new Set(settings.hiddenExerciseRefs);
  const hiddenCategoryRefs = new Set(settings.hiddenCategoryRefs);

  const globalCategories: MergedCategory[] = raw.globalCategories.flatMap(
    ({ id, data }) => {
      const ref = toRef(id, 'global');
      return ref
        ? [
            {
              id,
              ref,
              isCustom: false,
              name: resolveGlobalText(data.name, locale),
              order: data.order,
              icon: data.icon,
              isArchived: false,
              isRetired: data.isRetired,
            },
          ]
        : [];
    }
  );
  const customCategories: MergedCategory[] = raw.customCategories.flatMap(
    ({ id, data }) => {
      const ref = toRef(id, 'custom');
      return ref
        ? [
            {
              id,
              ref,
              isCustom: true,
              name: resolveUserText(data.name, locale, data.defaultLocale),
              order: data.order,
              icon: data.icon,
              isArchived: data.isArchived,
              isRetired: false,
            },
          ]
        : [];
    }
  );
  globalCategories.sort((left, right) => left.order - right.order);
  customCategories.sort((left, right) => left.order - right.order);
  const allCategories = [...globalCategories, ...customCategories];
  const categoryByRef = new Map(
    allCategories.map((category) => [category.ref, category])
  );

  const retiredEquipmentRefs = new Set<Ref>();
  const allEquipment: MergedEquipment[] = raw.equipment.flatMap(
    ({ id, data }) => {
      const ref = toRef(id, 'global');
      if (ref && data.isRetired) retiredEquipmentRefs.add(ref);
      return ref
        ? [
            {
              id,
              ref,
              name: resolveGlobalText(data.name, locale),
              icon: data.icon,
            },
          ]
        : [];
    }
  );
  allEquipment.sort((left, right) => left.name.localeCompare(right.name));
  const equipmentByRef = new Map(allEquipment.map((item) => [item.ref, item]));

  const globalExercises: MergedExercise[] = raw.globalExercises.flatMap(
    ({ id, data }) => {
      const ref = toRef(id, 'global');
      if (!ref) return [];
      return [
        {
          id,
          ref,
          isCustom: false,
          name: resolveGlobalText(data.name, locale),
          description: resolveGlobalText(data.description, locale),
          type: data.type,
          categoryRef: data.categoryRef,
          categoryName:
            categoryByRef.get(data.categoryRef)?.name ?? data.categoryRef,
          equipmentRefs: data.equipment,
          equipment: data.equipment.map(
            (equipmentItemRef) =>
              equipmentByRef.get(equipmentItemRef)?.name ?? equipmentItemRef
          ),
          imageURL: data.imageURL,
          isRetired: data.isRetired,
        },
      ];
    }
  );
  const customExercises: MergedExercise[] = raw.customExercises.flatMap(
    ({ id, data }) => {
      const ref = toRef(id, 'custom');
      if (!ref) return [];
      return [
        {
          id,
          ref,
          isCustom: true,
          name: resolveUserText(data.name, locale, data.defaultLocale),
          description: resolveUserText(
            data.description,
            locale,
            data.defaultLocale
          ),
          type: data.type,
          categoryRef: data.categoryRef,
          categoryName:
            categoryByRef.get(data.categoryRef)?.name ?? data.categoryRef,
          equipmentRefs: data.equipment,
          equipment: data.equipment.map(
            (equipmentItemRef) =>
              equipmentByRef.get(equipmentItemRef)?.name ?? equipmentItemRef
          ),
          imageURL: data.imageURL,
          isRetired: false,
        },
      ];
    }
  );
  const allExercises = [...globalExercises, ...customExercises];

  const categoryOrder = new Map(
    allCategories.map((category, index) => [category.ref, index])
  );
  const exercises = allExercises
    .filter(
      (exercise) =>
        !exercise.isRetired &&
        !hiddenExerciseRefs.has(exercise.ref) &&
        !hiddenCategoryRefs.has(exercise.categoryRef)
    )
    .sort((left, right) => {
      const orderDifference =
        (categoryOrder.get(left.categoryRef) ?? Number.MAX_SAFE_INTEGER) -
        (categoryOrder.get(right.categoryRef) ?? Number.MAX_SAFE_INTEGER);
      return orderDifference || left.name.localeCompare(right.name);
    });
  return {
    exercises,
    categories: allCategories.filter(
      (category) =>
        !category.isRetired &&
        !category.isArchived &&
        !hiddenCategoryRefs.has(category.ref)
    ),
    equipment: allEquipment.filter(({ ref }) => !retiredEquipmentRefs.has(ref)),
  };
};
