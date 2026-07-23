import type {
  CustomExercise,
  Difficulty,
  Exercise,
  ExerciseOverride,
  ExerciseType,
  UserExerciseGroup,
  WithId,
} from '@/database';
import type { QueryDocumentSnapshot } from '@react-native-firebase/firestore';
import { onSnapshot } from '@react-native-firebase/firestore';
import { create } from 'zustand';

import {
  customExercisesRef,
  exercisesRef,
  userGroupsRef,
  userOverridesRef,
} from '@/database';

export interface MergedExercise {
  id: string;
  isCustom: boolean;
  name: string;
  description: string;
  type: ExerciseType;
  groupId: string;
  groupName: string;
  equipment: string[];
  difficulty: Difficulty;
  imageURL: string | null;
}

export interface MergedGroup {
  id: string;
  name: string;
  order: number;
  icon: string | null;
}

interface ExerciseState {
  exercises: MergedExercise[];
  groups: MergedGroup[];
  isLoading: boolean;
  subscribe: (uid: string) => () => void;
  reset: () => void;
}

interface RawData {
  globalExercises: WithId<Exercise>[];
  overrides: Map<string, ExerciseOverride>;
  customExercises: WithId<CustomExercise>[];
  userGroups: Map<string, UserExerciseGroup>;
  firedListeners: Set<string>;
}

const buildMerged = (
  raw: RawData
): Pick<ExerciseState, 'exercises' | 'groups'> => {
  const groupMap = raw.userGroups;

  // Build groups array
  const groups: MergedGroup[] = [];
  for (const [id, g] of groupMap) {
    groups.push({ id, name: g.name, order: g.order, icon: g.icon });
  }
  groups.sort((a, b) => a.order - b.order);

  // Build a lookup: globalGroupId → userGroup
  const globalToUserGroup = new Map<string, { id: string; name: string }>();
  for (const [id, g] of groupMap) {
    if (g.globalGroupId) {
      globalToUserGroup.set(g.globalGroupId, { id, name: g.name });
    }
  }

  const exercises: MergedExercise[] = [];

  // Merge global exercises with overrides
  for (const { id, data: ex } of raw.globalExercises) {
    const override = raw.overrides.get(id);
    if (override?.isHidden) continue;

    const userGroup = globalToUserGroup.get(ex.groupKey);
    const groupId = override?.groupId ?? userGroup?.id ?? ex.groupKey;
    const resolvedGroup = groupMap.get(groupId);

    exercises.push({
      id,
      isCustom: false,
      name: override?.name ?? ex.name,
      description: override?.description ?? ex.description,
      type: ex.type,
      groupId,
      groupName: resolvedGroup?.name ?? ex.groupKey,
      equipment: ex.equipment,
      difficulty: ex.difficulty,
      imageURL: ex.imageURL,
    });
  }

  // Add custom exercises
  for (const { id, data: ex } of raw.customExercises) {
    const resolvedGroup = groupMap.get(ex.groupId);
    exercises.push({
      id,
      isCustom: true,
      name: ex.name,
      description: ex.description,
      type: ex.type,
      groupId: ex.groupId,
      groupName: resolvedGroup?.name ?? 'Custom',
      equipment: ex.equipment,
      difficulty: ex.difficulty,
      imageURL: ex.imageURL,
    });
  }

  // Sort by group order, then alphabetically
  const groupOrder = new Map(groups.map((g) => [g.id, g.order]));
  exercises.sort((a, b) => {
    const orderA = groupOrder.get(a.groupId) ?? 999;
    const orderB = groupOrder.get(b.groupId) ?? 999;
    if (orderA !== orderB) return orderA - orderB;
    return a.name.localeCompare(b.name);
  });

  return { exercises, groups };
};

export const useExerciseStore = create<ExerciseState>((set) => {
  const raw: RawData = {
    globalExercises: [],
    overrides: new Map(),
    customExercises: [],
    userGroups: new Map(),
    firedListeners: new Set(),
  };

  const recompute = () => {
    const allFired = raw.firedListeners.size >= 4;
    const merged = buildMerged(raw);
    set({ ...merged, isLoading: !allFired });
  };

  return {
    exercises: [],
    groups: [],
    isLoading: true,

    subscribe: (uid) => {
      raw.firedListeners.clear();

      const unsub1 = onSnapshot(
        exercisesRef(),
        (snap) => {
          raw.globalExercises = snap.docs.map((d: QueryDocumentSnapshot) => ({
            id: d.id,
            data: d.data() as Exercise,
          }));
          raw.firedListeners.add('global');
          recompute();
        },
        (error) => {
          console.error('[ExerciseStore:global]', error);
        }
      );

      const unsub2 = onSnapshot(
        userOverridesRef(uid),
        (snap) => {
          raw.overrides = new Map(
            snap.docs.map((d: QueryDocumentSnapshot) => [
              d.id,
              d.data() as ExerciseOverride,
            ])
          );
          raw.firedListeners.add('overrides');
          recompute();
        },
        (error) => {
          console.error('[ExerciseStore:overrides]', error);
        }
      );

      const unsub3 = onSnapshot(
        customExercisesRef(uid),
        (snap) => {
          raw.customExercises = snap.docs.map((d: QueryDocumentSnapshot) => ({
            id: d.id,
            data: d.data() as CustomExercise,
          }));
          raw.firedListeners.add('custom');
          recompute();
        },
        (error) => {
          console.error('[ExerciseStore:custom]', error);
        }
      );

      const unsub4 = onSnapshot(
        userGroupsRef(uid),
        (snap) => {
          raw.userGroups = new Map(
            snap.docs.map((d: QueryDocumentSnapshot) => [
              d.id,
              d.data() as UserExerciseGroup,
            ])
          );
          raw.firedListeners.add('groups');
          recompute();
        },
        (error) => {
          console.error('[ExerciseStore:groups]', error);
        }
      );

      return () => {
        unsub1();
        unsub2();
        unsub3();
        unsub4();
        raw.globalExercises = [];
        raw.overrides.clear();
        raw.customExercises = [];
        raw.userGroups.clear();
        raw.firedListeners.clear();
        set({ exercises: [], groups: [], isLoading: true });
      };
    },

    reset: () => set({ exercises: [], groups: [], isLoading: true }),
  };
});
