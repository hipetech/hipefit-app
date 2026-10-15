import type { TextFieldRef } from '@expo/ui/swift-ui';
import type React from 'react';
import { useRef } from 'react';
import { Button, HStack, Image, TextField } from '@expo/ui/swift-ui';
import {
  accessibilityHidden,
  accessibilityLabel,
  autocorrectionDisabled,
  background,
  buttonStyle,
  cornerRadius,
  foregroundStyle,
  padding,
  textInputAutocapitalization,
} from '@expo/ui/swift-ui/modifiers';

import { colors } from '@/theme/colors';

/**
 * A search field drawn like the system one: a filled rounded rectangle with a
 * leading magnifying glass and, while it holds text, a trailing clear button.
 * The sheet has no navigation stack, so it cannot use `.searchable`.
 */
const FIELD_MODIFIERS = [
  padding({ horizontal: 10, vertical: 8 }),
  background(colors.tertiarySystemFill),
  cornerRadius(10),
  padding({ horizontal: 16, bottom: 8 }),
];

const GLYPH_MODIFIERS = [
  foregroundStyle(colors.secondaryLabel),
  accessibilityHidden(true),
];

const INPUT_MODIFIERS = [
  textInputAutocapitalization('never'),
  autocorrectionDisabled(),
];

/**
 * `plain`, so the glyph keeps the tertiary label color of the system clear
 * button rather than the accent tint.
 */
const CLEAR_BUTTON_MODIFIERS = [
  buttonStyle('plain'),
  accessibilityLabel('Clear search'),
];

const CLEAR_GLYPH_MODIFIERS = [foregroundStyle(colors.tertiaryLabel)];

export interface ExercisePickerSearchFieldProps {
  /** Placeholder text, such as "Search" or "Search Chest". */
  placeholder: string;
  /** Whether the field holds text, which shows the clear button. */
  hasText: boolean;
  /** Called with the full text on every edit, and with `''` on clear. */
  onTextChange: (text: string) => void;
}

/**
 * The picker's search field, under the header row. Host-less. The text is
 * owned natively: the clear button empties it through the field's ref, and the
 * picker clears it on a change of view by remounting the field with a new
 * `key`.
 */
export const ExercisePickerSearchField: React.FC<
  ExercisePickerSearchFieldProps
> = ({ placeholder, hasText, onTextChange }) => {
  const fieldRef = useRef<TextFieldRef>(null);

  // `clear()` writes the native text, whose change also reaches
  // `onTextChange`. The direct call updates the picker without waiting for
  // that event.
  const handleClear = () => {
    void fieldRef.current?.clear();
    onTextChange('');
  };

  return (
    <HStack spacing={6} modifiers={FIELD_MODIFIERS}>
      <Image systemName="magnifyingglass" modifiers={GLYPH_MODIFIERS} />
      <TextField
        ref={fieldRef}
        placeholder={placeholder}
        onTextChange={onTextChange}
        modifiers={INPUT_MODIFIERS}
      />
      {hasText ? (
        <Button onPress={handleClear} modifiers={CLEAR_BUTTON_MODIFIERS}>
          <Image
            systemName="xmark.circle.fill"
            modifiers={CLEAR_GLYPH_MODIFIERS}
          />
        </Button>
      ) : null}
    </HStack>
  );
};
