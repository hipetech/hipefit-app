import type { DifficultyFilterProps } from './difficulty-filter';
import { Host, Picker } from '@expo/ui';

import { useAppColorScheme } from '@/hooks/use-app-color-scheme';
import { BRAND_SEED } from '@/theme/colors';

/**
 * Difficulty filter (Android fallback): native menu `Picker`. Segmented style
 * is iOS-only, so Android uses the cross-platform menu appearance.
 */
export const DifficultyFilter = ({
  value,
  onValueChange,
}: DifficultyFilterProps) => {
  const colorScheme = useAppColorScheme();

  return (
    <Host matchContents seedColor={BRAND_SEED} colorScheme={colorScheme}>
      <Picker
        selectedValue={value}
        onValueChange={onValueChange}
        appearance="menu"
      >
        <Picker.Item label="All" value="all" />
        <Picker.Item label="Beginner" value="beginner" />
        <Picker.Item label="Intermediate" value="intermediate" />
        <Picker.Item label="Advanced" value="advanced" />
      </Picker>
    </Host>
  );
};
