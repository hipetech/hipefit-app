import type React from 'react';
import { useEffect } from 'react';
import { StyleSheet } from 'react-native';
import { Host } from '@expo/ui';

import { useAppColorScheme } from '@/hooks/use-app-color-scheme';
import { useCustomExerciseSheetStore } from '@/stores/use-custom-exercise-sheet-store';

import { CustomExerciseBottomSheet } from './custom-exercise-bottom-sheet';

const styles = StyleSheet.create({
  /**
   * The `Host` is a self-presenting overlay: the `BottomSheet` inside it draws
   * itself, so the host view must take no space in the layout.
   */
  host: { position: 'absolute' },
});

/**
 * The sheet that creates a custom exercise from the create panel: a
 * `CustomExerciseBottomSheet` in its own `Host` island, following
 * `exercise-detail-sheet.tsx`. It takes no props. Presentation comes from
 * `useCustomExerciseSheetStore`, because the dock action that opens the sheet
 * and the layout that mounts it do not contain each other.
 */
export const CustomExerciseSheet: React.FC = () => {
  const colorScheme = useAppColorScheme();
  const isPresented = useCustomExerciseSheetStore((state) => state.isPresented);
  const close = useCustomExerciseSheetStore((state) => state.close);

  // The layout that mounts this sheet unmounts when the session ends. A store
  // left at `isPresented: true` would present the sheet at the next sign-in.
  useEffect(() => () => close(), [close]);

  return (
    <Host style={styles.host} pointerEvents="none" colorScheme={colorScheme}>
      <CustomExerciseBottomSheet isPresented={isPresented} onClose={close} />
    </Host>
  );
};
