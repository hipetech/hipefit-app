import type React from 'react';
import { Button, HStack, Image, Spacer, Text } from '@expo/ui/swift-ui';
import {
  accessibilityAddTraits,
  accessibilityHidden,
  font,
} from '@expo/ui/swift-ui/modifiers';

import { mods } from '@/theme/modifiers';

/**
 * The checkmark inherits the `Button`'s foreground, which is the system accent,
 * so it matches the selection mark UIKit draws. It is sized with a text style so
 * it scales with the name beside it, and hidden from VoiceOver because the
 * selected trait on the row already says it.
 */
const CHECKMARK_MODIFIERS = [
  font({ textStyle: 'body', weight: 'semibold' }),
  accessibilityHidden(true),
];

const SELECTED_ROW_MODIFIERS = [accessibilityAddTraits(['isSelected'])];

export interface CustomExerciseEquipmentRowProps {
  /** Equipment name, already resolved to the user's language. */
  name: string;
  /** Whether this equipment is part of the exercise being created. */
  isSelected: boolean;
  /** Toggles this equipment in the selection. */
  onPress: () => void;
}

/**
 * One selectable equipment row of the custom exercise form. Host-less: it
 * renders inside the form's `List`.
 */
export const CustomExerciseEquipmentRow: React.FC<
  CustomExerciseEquipmentRowProps
> = ({ name, isSelected, onPress }) => (
  <Button
    onPress={onPress}
    modifiers={isSelected ? SELECTED_ROW_MODIFIERS : undefined}
  >
    <HStack>
      {/* An explicit label color: text inside a `Button` otherwise takes the
          accent tint, which would make every row read as a link. */}
      <Text modifiers={mods.bodyLabel}>{name}</Text>
      <Spacer />
      {isSelected ? (
        <Image systemName="checkmark" modifiers={CHECKMARK_MODIFIERS} />
      ) : null}
    </HStack>
  </Button>
);
