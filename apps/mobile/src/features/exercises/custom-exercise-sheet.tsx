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
import { useCustomExerciseSheetStore } from '@/stores/use-custom-exercise-sheet-store';

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
 * This is the app's only `List` inside a `BottomSheet`, and the layout was
 * written against the typings without a device run. If the list does not fill
 * the sheet or does not scroll, the fallback is `Form` from `@expo/ui/swift-ui`.
 */
const SHEET_PRESENTATION_MODIFIERS = [
  presentationDetents(['medium', { fraction: 0.9 }]),
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
 * The sheet that creates a custom exercise: a SwiftUI `BottomSheet` in its own
 * `Host` island, following `exercise-detail-sheet.tsx`. It takes no props.
 * Presentation comes from `useCustomExerciseSheetStore`, because the dock action
 * that opens the sheet and the layout that mounts it do not contain each other.
 */
export const CustomExerciseSheet: React.FC = () => {
  const colorScheme = useAppColorScheme();
  const isPresented = useCustomExerciseSheetStore((state) => state.isPresented);
  const close = useCustomExerciseSheetStore((state) => state.close);
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
              starts with an empty form. */}
          {isPresented ? (
            <CustomExerciseForm
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
