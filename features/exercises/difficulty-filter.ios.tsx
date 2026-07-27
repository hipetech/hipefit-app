import type { DifficultyFilterProps } from './difficulty-filter';
import { Host } from '@expo/ui';
import { Picker, Text } from '@expo/ui/swift-ui';
import { pickerStyle, tag } from '@expo/ui/swift-ui/modifiers';

import { useAppColorScheme } from '@/hooks/use-app-color-scheme';
import { BRAND_SEED } from '@/theme/colors';

/**
 * Difficulty filter (SwiftUI segmented `Picker`). Replaces the heroui
 * `RadioGroup`; a segmented control does not re-fire for the active segment, so
 * the screen's re-tap guard stays harmless.
 */
export const DifficultyFilter = ({
  value,
  onValueChange,
}: DifficultyFilterProps) => {
  const colorScheme = useAppColorScheme();

  return (
    <Host matchContents seedColor={BRAND_SEED} colorScheme={colorScheme}>
      <Picker
        selection={value}
        onSelectionChange={onValueChange}
        modifiers={[pickerStyle('segmented')]}
      >
        <Text modifiers={[tag('all')]}>All</Text>
        <Text modifiers={[tag('beginner')]}>Beginner</Text>
        <Text modifiers={[tag('intermediate')]}>Intermediate</Text>
        <Text modifiers={[tag('advanced')]}>Advanced</Text>
      </Picker>
    </Host>
  );
};
