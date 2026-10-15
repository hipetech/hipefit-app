import type { MergedExercise } from '@/features/exercises/exercise-catalogue';
import type { Ref } from '@hipefit/schemas';
import type React from 'react';
import { useCallback, useMemo, useState } from 'react';
import {
  BottomSheet,
  Button,
  Group,
  HStack,
  Spacer,
  Text,
  VStack,
} from '@expo/ui/swift-ui';
import {
  disabled,
  font,
  lineLimit,
  padding,
  presentationDetents,
  presentationDragIndicator,
} from '@expo/ui/swift-ui/modifiers';

import { hapticSelection } from '@/lib/haptics';
import { useExerciseStore } from '@/stores/use-exercise-store';

import { ExercisePickerList } from './exercise-picker-list';

/**
 * Fixed detents, as in `custom-exercise-sheet.tsx`, because the body is a
 * `List`. `fitToContents` sizes the sheet from its children, and a `List`
 * reports no intrinsic height, so the sheet has to own the height and the
 * `VStack` hands the `List` whatever the header row leaves. Like the editor it
 * presents over, it opens at full height (`selection: 'large'`) and can be
 * dragged down to `medium`. At full height iOS 26 draws it opaque, and the rows
 * keep their system fill so they stay visible against that background.
 */
const SHEET_PRESENTATION_MODIFIERS = [
  presentationDetents(['medium', 'large'], { selection: 'large' }),
  presentationDragIndicator('visible'),
];

/**
 * The header row stands in for a navigation bar, which the sheet has no stack
 * to draw. The top inset clears the drag indicator.
 */
const HEADER_MODIFIERS = [padding({ horizontal: 16, top: 20, bottom: 8 })];

const TITLE_MODIFIERS = [font({ textStyle: 'headline' }), lineLimit(1)];

const ADD_LABEL_MODIFIERS = [font({ textStyle: 'body', weight: 'semibold' })];

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
 * `Host`: the template editor renders it inside its own sheet's content, which
 * is already inside the editor's `Host`, and a `Host` must never nest. The
 * presenting `Host` also supplies the color scheme.
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
        {/* The body is mounted only while presented, so the filter and the
            list start fresh on every presentation. */}
        {isPresented ? (
          <VStack spacing={0}>
            <HStack modifiers={HEADER_MODIFIERS}>
              <Button label="Cancel" onPress={handleCancel} />
              <Spacer />
              <Text modifiers={TITLE_MODIFIERS}>Add Exercises</Text>
              <Spacer />
              <Button
                onPress={handleAdd}
                modifiers={[disabled(selectedCount === 0)]}
              >
                <Text modifiers={ADD_LABEL_MODIFIERS}>
                  {selectedCount > 0 ? `Add (${selectedCount})` : 'Add'}
                </Text>
              </Button>
            </HStack>
            <ExercisePickerList
              selectedRefs={selectedRefs}
              onToggle={handleToggle}
            />
          </VStack>
        ) : (
          <VStack>
            <Text> </Text>
          </VStack>
        )}
      </Group>
    </BottomSheet>
  );
};
