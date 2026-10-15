import type { Ref } from '@hipefit/schemas';
import type React from 'react';
import { useState } from 'react';
import { BottomSheet, Group, Text, VStack } from '@expo/ui/swift-ui';
import {
  interactiveDismissDisabled,
  presentationDetents,
  presentationDragIndicator,
} from '@expo/ui/swift-ui/modifiers';

import { CustomExerciseForm } from './custom-exercise-form';

/**
 * Fixed detents, not `fitToContents`. The content is a `List`, and a `List` has
 * no intrinsic content height: `fitToContents` measures the children
 * (`BottomSheetView.swift` at @expo/ui 57.0.7) and would size the sheet from a
 * height the `List` does not report. With fixed detents the sheet owns the
 * height, and the form's `VStack` gives the `List` whatever its header row
 * leaves.
 *
 * `medium` comes first so the sheet opens at half height. The taller detent is
 * a 0.9 fraction, not `large`: iOS 26 draws a sheet with its translucent
 * material only below full height and turns it opaque at `large`. Stopping
 * short of full height is meant to keep the material while still showing most
 * of the form. 0.9 is the upper detent the Edit Profile form sheet uses.
 *
 * The exercise picker sheet reuses this layout. It was written against the
 * typings without a device run. If the list does not fill the sheet or does
 * not scroll, the fallback is `Form` from `@expo/ui/swift-ui`.
 */
const SHEET_PRESENTATION_MODIFIERS = [
  presentationDetents(['medium', { fraction: 0.9 }]),
  presentationDragIndicator('visible'),
];

export interface CustomExerciseBottomSheetProps {
  /** Whether the sheet is presented. */
  isPresented: boolean;
  /** Called by Cancel, a swipe-down, and a save that succeeded. */
  onClose: () => void;
  /** Called with the new exercise's ref after a save that succeeded. */
  onSaved?: (ref: Ref) => void;
  /** The name the form starts with. @default '' */
  initialName?: string;
  /** The category the form starts with. @default null */
  initialCategoryRef?: Ref | null;
}

/**
 * The `BottomSheet` that holds `CustomExerciseForm`. Host-less:
 * `custom-exercise-sheet.tsx` gives it a `Host` island of its own, and the
 * exercise picker renders it inside its own sheet's content, so it presents
 * over the picker.
 */
export const CustomExerciseBottomSheet: React.FC<
  CustomExerciseBottomSheetProps
> = ({ isPresented, onClose, onSaved, initialName, initialCategoryRef }) => {
  const [isDismissLocked, setDismissLocked] = useState(false);

  return (
    <BottomSheet
      isPresented={isPresented}
      onIsPresentedChange={(presented) => {
        if (!presented) onClose();
      }}
    >
      {/* The lock blocks only the swipe. Cancel and a finished save set
          `isPresented` to false, which dismisses regardless. `isPresented`
          gates it so a lock reported by the previous form cannot outlast
          that form. */}
      <Group
        modifiers={[
          ...SHEET_PRESENTATION_MODIFIERS,
          interactiveDismissDisabled(isPresented && isDismissLocked),
        ]}
      >
        {/* The form is mounted only while presented, so each presentation
            starts from the initial values. */}
        {isPresented ? (
          <CustomExerciseForm
            initialName={initialName}
            initialCategoryRef={initialCategoryRef}
            onSaved={onSaved}
            onClose={onClose}
            onDismissLockChange={setDismissLocked}
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
