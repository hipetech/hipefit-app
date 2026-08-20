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
} from '@/database';
import type { SnapshotOptions } from '@react-native-firebase/firestore';
import { onSnapshot } from '@react-native-firebase/firestore';
import { create } from 'zustand';

import {
  customExerciseCategoriesRef,
  customExercisesRef,
  decodeCustomExercise,
  decodeCustomExerciseCategory,
  decodeEquipment,
  decodeExercise,
  decodeExerciseCategory,
  equipmentRef,
  exerciseCategoriesRef,
  exercisesRef,
} from '@/database';
import { useUserStore } from '@/features/user/store/use-user-store';

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

interface ExerciseState {
  exercises: MergedExercise[];
  categories: MergedCategory[];
  equipment: MergedEquipment[];
  isLoading: boolean;
  subscribe: (uid: string) => () => void;
}

type ListenerName =
  | 'globalExercises'
  | 'globalCategories'
  | 'equipment'
  | 'customExercises'
  | 'customCategories';

interface RawData {
  globalExercises: WithId<Exercise>[];
  globalCategories: WithId<ExerciseCategory>[];
  equipment: WithId<Equipment>[];
  customExercises: WithId<CustomExercise>[];
  customCategories: WithId<CustomExerciseCategory>[];
  firedListeners: Set<ListenerName>;
}

const LISTENER_COUNT = 5;
const globalIdPattern = /^[a-z0-9-]+$/;
const customIdPattern = /^[A-Za-z0-9_-]{1,64}$/;

const defaultSettings: UserSettings = {
  theme: 'system',
  language: 'en',
  units: 'metric',
  hiddenExerciseRefs: [],
  hiddenCategoryRefs: [],
};

const toRef = (id: string, scope: 'global' | 'custom'): Ref | null => {
  const pattern = scope === 'global' ? globalIdPattern : customIdPattern;
  if (!pattern.test(id)) {
    console.error(`[ExerciseStore] Dropped malformed ${scope} document ID`, id);
    return null;
  }
  return `${scope}:${id}`;
};

const decodeDocuments = <T>(
  documents: readonly {
    id: string;
    data: (options?: SnapshotOptions) => unknown;
  }[],
  decode: (value: unknown) => T | null
): WithId<T>[] => {
  const decoded: WithId<T>[] = [];
  for (const document of documents) {
    const data = decode(document.data({ serverTimestamps: 'estimate' }));
    if (data) decoded.push({ id: document.id, data });
  }
  return decoded;
};

const buildMerged = (
  raw: RawData,
  settings: UserSettings
): Pick<ExerciseState, 'exercises' | 'categories' | 'equipment'> => {
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

export const useExerciseStore = create<ExerciseState>((set) => {
  const raw: RawData = {
    globalExercises: [],
    globalCategories: [],
    equipment: [],
    customExercises: [],
    customCategories: [],
    firedListeners: new Set(),
  };

  const recompute = () => {
    const userState = useUserStore.getState();
    const settings = userState.profile?.settings ?? defaultSettings;
    set({
      ...buildMerged(raw, settings),
      isLoading:
        raw.firedListeners.size < LISTENER_COUNT || userState.isLoading,
    });
  };

  const markFailed = (listener: ListenerName, error: Error) => {
    console.error(`[ExerciseStore:${listener}]`, error);
    raw.firedListeners.add(listener);
    recompute();
  };

  return {
    exercises: [],
    categories: [],
    equipment: [],
    isLoading: true,

    subscribe: (uid) => {
      raw.firedListeners.clear();

      const unsubscribeGlobalExercises = onSnapshot(
        exercisesRef(),
        (snapshot) => {
          raw.globalExercises = decodeDocuments(snapshot.docs, decodeExercise);
          raw.firedListeners.add('globalExercises');
          recompute();
        },
        (error) => markFailed('globalExercises', error)
      );
      const unsubscribeGlobalCategories = onSnapshot(
        exerciseCategoriesRef(),
        (snapshot) => {
          raw.globalCategories = decodeDocuments(
            snapshot.docs,
            decodeExerciseCategory
          );
          raw.firedListeners.add('globalCategories');
          recompute();
        },
        (error) => markFailed('globalCategories', error)
      );
      const unsubscribeEquipment = onSnapshot(
        equipmentRef(),
        (snapshot) => {
          raw.equipment = decodeDocuments(snapshot.docs, decodeEquipment);
          raw.firedListeners.add('equipment');
          recompute();
        },
        (error) => markFailed('equipment', error)
      );
      const unsubscribeCustomExercises = onSnapshot(
        customExercisesRef(uid),
        (snapshot) => {
          raw.customExercises = decodeDocuments(
            snapshot.docs,
            decodeCustomExercise
          );
          raw.firedListeners.add('customExercises');
          recompute();
        },
        (error) => markFailed('customExercises', error)
      );
      const unsubscribeCustomCategories = onSnapshot(
        customExerciseCategoriesRef(uid),
        (snapshot) => {
          raw.customCategories = decodeDocuments(
            snapshot.docs,
            decodeCustomExerciseCategory
          );
          raw.firedListeners.add('customCategories');
          recompute();
        },
        (error) => markFailed('customCategories', error)
      );
      const unsubscribeSettings = useUserStore.subscribe((state, previous) => {
        const settings = state.profile?.settings;
        const previousSettings = previous.profile?.settings;
        if (
          settings?.language !== previousSettings?.language ||
          settings?.hiddenExerciseRefs !==
            previousSettings?.hiddenExerciseRefs ||
          settings?.hiddenCategoryRefs !==
            previousSettings?.hiddenCategoryRefs ||
          state.isLoading !== previous.isLoading
        ) {
          recompute();
        }
      });

      return () => {
        unsubscribeGlobalExercises();
        unsubscribeGlobalCategories();
        unsubscribeEquipment();
        unsubscribeCustomExercises();
        unsubscribeCustomCategories();
        unsubscribeSettings();
        raw.globalExercises = [];
        raw.globalCategories = [];
        raw.equipment = [];
        raw.customExercises = [];
        raw.customCategories = [];
        raw.firedListeners.clear();
        set({
          exercises: [],
          categories: [],
          equipment: [],
          isLoading: true,
        });
      };
    },
  };
});
