import type { MergedExercise } from '@/features/exercises/exercise-catalogue';
import type { Ref } from '@hipefit/schemas';
import type React from 'react';
import { useCallback, useMemo, useState } from 'react';
import { BottomSheet, Group, Text, VStack } from '@expo/ui/swift-ui';
import {
  presentationDetents,
  presentationDragIndicator,
} from '@expo/ui/swift-ui/modifiers';

import { hapticSelection } from '@/lib/haptics';
import { useExerciseStore } from '@/stores/use-exercise-store';

import { ExercisePickerContent } from './exercise-picker-content';

/**
 * Fixed detents, as in `custom-exercise-sheet.tsx`, because the body is a
 * `List`. `fitToContents` sizes the sheet from its children, and a `List`
 * reports no intrinsic height, so the sheet has to own the height and the
 * `VStack` hands the `List` or the category grid whatever the header row and
 * the search field leave. It opens at full
 * height (`selection: 'large'`), over the template editor, and can be
 * dragged down to `medium`. At full height iOS 26 draws it opaque, and the rows
 * keep their system fill so they stay visible against that background.
 */
const SHEET_PRESENTATION_MODIFIERS = [
  presentationDetents(['medium', 'large'], { selection: 'large' }),
  presentationDragIndicator('visible'),
];

const NO_SELECTION: ReadonlySet<Ref> = new Set();

export interface ExercisePickerSheetProps {
  /** Whether the picker is presented. */
  isPresented: boolean;
  /** Called by Cancel and by a swipe-down. The picker returns nothing. */
  onCancel: () => void;
  /** Called by Add with the selected exercises, in catalogue order. */
  onAdd: (exercises: MergedExercise[]) => void;
}

/**
 * A `BottomSheet` that picks several exercises from the catalogue. It opens no
 * `Host`: `workout-template-editor.tsx` wraps it in its own `Host` island,
 * which also supplies the color scheme.
 */
export const ExercisePickerSheet: React.FC<ExercisePickerSheetProps> = ({
  isPresented,
  onCancel,
  onAdd,
}) => {
  const exercises = useExerciseStore((state) => state.exercises);
  const [selectedRefs, setSelectedRefs] =
    useState<ReadonlySet<Ref>>(NO_SELECTION);

  // Read through the live catalogue, so an exercise that stops being published
  // while selected is neither counted nor returned.
  const selectedExercises = useMemo(
    () => exercises.filter((exercise) => selectedRefs.has(exercise.ref)),
    [exercises, selectedRefs]
  );
  const selectedCount = selectedExercises.length;

  const handleToggle = useCallback((ref: Ref) => {
    hapticSelection();
    setSelectedRefs((current) => {
      const next = new Set(current);
      if (!next.delete(ref)) next.add(ref);
      return next;
    });
  }, []);

  // The form fires its own success haptic, so selecting the new exercise adds
  // none.
  const handleCreated = useCallback((ref: Ref) => {
    setSelectedRefs((current) => new Set(current).add(ref));
  }, []);

  const clearSelection = useCallback(() => setSelectedRefs(NO_SELECTION), []);

  const handleCancel = useCallback(() => {
    clearSelection();
    onCancel();
  }, [clearSelection, onCancel]);

  const handleAdd = useCallback(() => {
    if (selectedExercises.length === 0) return;
    clearSelection();
    onAdd(selectedExercises);
  }, [clearSelection, onAdd, selectedExercises]);

  // `onIsPresentedChange` fires only for a dismissal the props did not ask for,
  // which is the swipe: `BottomSheetView.swift` at @expo/ui 57.0.7 skips the
  // event when the native state already matches `isPresented`. `onDismiss`
  // fires after every dismissal, so it also clears a selection left by a close
  // the editor drives itself.
  return (
    <BottomSheet
      isPresented={isPresented}
      onIsPresentedChange={(presented) => {
        if (!presented) handleCancel();
      }}
      onDismiss={clearSelection}
    >
      <Group modifiers={SHEET_PRESENTATION_MODIFIERS}>
        {/* The body is mounted only while presented, so the view and the
            search start fresh on every presentation. */}
        {isPresented ? (
          <ExercisePickerContent
            selectedRefs={selectedRefs}
            selectedCount={selectedCount}
            onToggle={handleToggle}
            onCancel={handleCancel}
            onAdd={handleAdd}
            onCreated={handleCreated}
          />
        ) : (
          <VStack>
            <Text> </Text>
          </VStack>
        )}
      </Group>
    </BottomSheet>
  );
};
