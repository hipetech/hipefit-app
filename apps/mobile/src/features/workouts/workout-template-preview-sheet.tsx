import type { UnitSystem } from '@/lib/units';
import type { WorkoutTemplate } from '@hipefit/schemas';
import type React from 'react';
import { StyleSheet } from 'react-native';
import { Host } from '@expo/ui';
import { BottomSheet, Group, Text, VStack } from '@expo/ui/swift-ui';
import {
  presentationDetents,
  presentationDragIndicator,
} from '@expo/ui/swift-ui/modifiers';

import { useAppColorScheme } from '@/hooks/use-app-color-scheme';
import { useUserStore } from '@/stores/use-user-store';

import { WorkoutTemplatePreview } from './workout-template-preview';

/**
 * Fixed detents, not `fitToContents`, because the content is a `List`, which
 * reports no height for `fitToContents` to measure (see `Host` ownership in
 * `docs/app/ui.md`). Like the template editor, it opens at full height and can
 * be dragged down to half height.
 */
const SHEET_PRESENTATION_MODIFIERS = [
  presentationDetents(['medium', 'large'], { selection: 'large' }),
  presentationDragIndicator('visible'),
];

const styles = StyleSheet.create({
  /** A self-presenting overlay: the `BottomSheet` draws itself, so the host takes no space. */
  host: { position: 'absolute' },
});

export interface WorkoutTemplatePreviewSheetProps {
  /**
   * The template to show. It stays set while the sheet dismisses, so the
   * content does not empty out during the animation.
   */
  template: WorkoutTemplate | null;
  isPresented: boolean;
  onClose: () => void;
}

/**
 * A read-only preview of a saved workout template, presented from a card on
 * the Workouts screen. A SwiftUI `BottomSheet` in its own `Host` island,
 * following `exercise-detail-sheet.tsx`. It has no actions yet: editing and
 * starting a template do not exist.
 */
export const WorkoutTemplatePreviewSheet: React.FC<
  WorkoutTemplatePreviewSheetProps
> = ({ template, isPresented, onClose }) => {
  const colorScheme = useAppColorScheme();
  const units = useUserStore(
    (state): UnitSystem => state.profile?.settings.units ?? 'metric'
  );

  return (
    <Host style={styles.host} pointerEvents="none" colorScheme={colorScheme}>
      <BottomSheet
        isPresented={isPresented}
        onIsPresentedChange={(presented) => {
          if (!presented) onClose();
        }}
      >
        <Group modifiers={SHEET_PRESENTATION_MODIFIERS}>
          {template === null ? (
            <VStack>
              <Text> </Text>
            </VStack>
          ) : (
            <WorkoutTemplatePreview template={template} units={units} />
          )}
        </Group>
      </BottomSheet>
    </Host>
  );
};
