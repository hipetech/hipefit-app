import type React from 'react';
import { useEffect, useState } from 'react';
import { StyleSheet } from 'react-native';
import { Host } from '@expo/ui';
import { BottomSheet, Group, Text, VStack } from '@expo/ui/swift-ui';
import {
  interactiveDismissDisabled,
  presentationDetents,
  presentationDragIndicator,
} from '@expo/ui/swift-ui/modifiers';

import { useAppColorScheme } from '@/hooks/use-app-color-scheme';
import { useWorkoutTemplateSheetStore } from '@/stores/use-workout-template-sheet-store';

import { WorkoutTemplateForm } from './workout-template-form';

/**
 * Fixed detents, not `fitToContents`, as in `custom-exercise-sheet.tsx`. The
 * body below the header is an `RNHostView` that fills whatever space SwiftUI
 * proposes, so it reports no content height for `fitToContents` to measure
 * (`BottomSheetView.swift` at @expo/ui 57.0.7). With fixed detents the sheet
 * owns the height, and the form's `VStack` gives the hosted list whatever the
 * header row leaves.
 *
 * `selection: 'large'` opens the sheet at full height, because the editor
 * needs the room for its exercise list, and `medium` lets the user drag it
 * down to half height. At full height iOS 26 draws the sheet opaque rather
 * than with its translucent material.
 */
const SHEET_PRESENTATION_MODIFIERS = [
  presentationDetents(['medium', 'large'], { selection: 'large' }),
  presentationDragIndicator('visible'),
];

const styles = StyleSheet.create({
  /**
   * The `Host` is a self-presenting overlay: the `BottomSheet` inside it draws
   * itself, so the host view must take no space in the layout.
   */
  host: { position: 'absolute' },
});

/**
 * The sheet that creates a workout template: a SwiftUI `BottomSheet` in its own
 * `Host` island, following `custom-exercise-sheet.tsx`. It takes no props.
 * Presentation comes from `useWorkoutTemplateSheetStore`, because the dock
 * action that opens the sheet and the layout that mounts it do not contain
 * each other.
 */
export const WorkoutTemplateSheet: React.FC = () => {
  const colorScheme = useAppColorScheme();
  const isPresented = useWorkoutTemplateSheetStore(
    (state) => state.isPresented
  );
  const close = useWorkoutTemplateSheetStore((state) => state.close);
  const [isDismissLocked, setDismissLocked] = useState(false);

  // The layout that mounts this sheet unmounts when the session ends. A store
  // left at `isPresented: true` would present the sheet at the next sign-in.
  useEffect(() => () => close(), [close]);

  return (
    <Host style={styles.host} pointerEvents="none" colorScheme={colorScheme}>
      <BottomSheet
        isPresented={isPresented}
        onIsPresentedChange={(presented) => {
          if (!presented) close();
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
              starts with an empty draft. */}
          {isPresented ? (
            <WorkoutTemplateForm
              onClose={close}
              onDismissLockChange={setDismissLocked}
            />
          ) : (
            <VStack>
              <Text> </Text>
            </VStack>
          )}
        </Group>
      </BottomSheet>
    </Host>
  );
};
