import type {
  TemplateSetDraft,
  TemplateSetField,
} from './workout-template-draft';
import type { UnitSystem } from '@/lib/units';
import type { ExerciseType } from '@hipefit/schemas';
import type React from 'react';
import type { KeyboardTypeOptions } from 'react-native';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import { SortableDragExclusion } from '@hipefit/sortable-list';

import { Text } from '@/components/text';
import { hapticSelection } from '@/lib/haptics';
import { getUnitLabels } from '@/lib/units';
import { colors } from '@/theme/colors';

import {
  TEMPLATE_SET_FIELDS,
  WORKOUT_TEMPLATE_NOTES_MAX_LENGTH,
} from './workout-template-draft';

/**
 * Field names as the inputs show them. `workout-template-draft.ts` keeps the
 * same words for its validation messages and does not export them.
 */
const FIELD_NAMES: Record<TemplateSetField, string> = {
  weight: 'Weight',
  reps: 'Reps',
  duration: 'Duration',
  distance: 'Distance',
};

/** Reps are whole numbers; every other field takes a decimal. */
const FIELD_KEYBOARDS: Record<TemplateSetField, KeyboardTypeOptions> = {
  weight: 'decimal-pad',
  reps: 'number-pad',
  duration: 'decimal-pad',
  distance: 'decimal-pad',
};

/** 24pt of drawn circle plus 10pt of slop on each side is Apple's 44pt minimum. */
const REMOVE_HIT_SLOP = 10;

const styles = StyleSheet.create({
  container: {
    gap: 6,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  number: {
    minWidth: 20,
    color: colors.secondaryLabel,
    fontVariant: ['tabular-nums'],
  },
  /** The whole box is the drag exclusion, so a long press on the unit label does not lift the row either. */
  field: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 36,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: colors.tertiarySystemBackground,
  },
  /**
   * `TextInput` has no `dynamicTypeRamp`, so it scales by React Native's flat
   * multiplier rather than the `body` ramp `Text` follows. The size matches
   * the `body` variant at the default Dynamic Type size.
   */
  input: {
    flex: 1,
    paddingVertical: 8,
    fontSize: 17,
    color: colors.label,
    fontVariant: ['tabular-nums'],
  },
  unit: {
    marginLeft: 4,
    color: colors.secondaryLabel,
  },
  noteButton: {
    width: 28,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  noteGlyph: {
    color: colors.secondaryLabel,
  },
  noteGlyphActive: {
    color: colors.accent,
  },
  /** Indented to line up with the first field, past the set number. */
  noteField: {
    marginLeft: 28,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: colors.tertiarySystemBackground,
  },
  noteInput: {
    paddingVertical: 8,
    fontSize: 15,
    color: colors.label,
  },
  removeCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.tertiarySystemFill,
  },
  /**
   * A minus drawn as a bar: this tree is plain React Native inside the
   * sheet's `Host`, so an SF Symbol would need a nested `Host`.
   */
  removeBar: {
    width: 10,
    height: 2,
    borderRadius: 1,
    backgroundColor: colors.secondaryLabel,
  },
});

export interface TemplateSetRowProps {
  /** The set's values as typed, in the user's units. */
  set: TemplateSetDraft;
  /** One-based position of the set within its exercise. */
  setNumber: number;
  /** The exercise's type, which decides the fields shown. */
  type: ExerciseType;
  /** The exercise's name, for the inputs' accessibility labels. */
  exerciseName: string;
  /** The user's unit system, which decides the unit labels. */
  units: UnitSystem;
  /** Called with the new text of a field as the user types it. */
  onChangeField: (field: TemplateSetField, value: string) => void;
  /** Whether the user has opened the note field. A set with a note shows it regardless. */
  isNoteOpen: boolean;
  /** Opens or closes the note field. */
  onToggleNote: () => void;
  /** Called with the note's new text as the user types it. */
  onChangeNotes: (notes: string) => void;
  /** Removes this set. */
  onRemove: () => void;
}

/**
 * One set of a template exercise: its number, a numeric input for each field
 * the exercise type uses, a note button, and a remove control. The note field
 * shows below the set once opened, and always when the set has a note.
 *
 * Plain React Native, because it renders inside an `RNHostView` in the
 * template sheet's `Host`, and a `Host` cannot nest. It renders only from its
 * props, because `SortableList` draws the lifted row a second time. Each input
 * sits in `SortableDragExclusion`, so a long press in a field selects text
 * instead of lifting the exercise row.
 */
export const TemplateSetRow: React.FC<TemplateSetRowProps> = ({
  set,
  setNumber,
  type,
  exerciseName,
  units,
  onChangeField,
  isNoteOpen,
  onToggleNote,
  onChangeNotes,
  onRemove,
}) => {
  const unitLabels = getUnitLabels(units);
  const hasNote = set.notes.trim().length > 0;
  const showsNote = isNoteOpen || hasNote;

  const handleToggleNote = (): void => {
    hapticSelection();
    onToggleNote();
  };

  const handleRemove = (): void => {
    hapticSelection();
    onRemove();
  };

  return (
    <View style={styles.container}>
      <View style={styles.row}>
        <Text
          variant="subheadline"
          style={styles.number}
          accessibilityLabel={`Set ${setNumber}`}
        >
          {String(setNumber)}
        </Text>
        {TEMPLATE_SET_FIELDS[type].map((field) => {
          const unit = field === 'reps' ? null : unitLabels[field];
          const name = FIELD_NAMES[field];
          return (
            <SortableDragExclusion key={field} style={styles.field}>
              <TextInput
                style={styles.input}
                value={set[field]}
                onChangeText={(value) => onChangeField(field, value)}
                keyboardType={FIELD_KEYBOARDS[field]}
                placeholder={name}
                placeholderTextColor={colors.placeholderText}
                selectTextOnFocus
                accessibilityLabel={`${exerciseName}, set ${setNumber}, ${name}${
                  unit === null ? '' : `, ${unit}`
                }`}
              />
              {unit === null ? null : (
                <Text
                  variant="subheadline"
                  style={styles.unit}
                  accessibilityElementsHidden
                >
                  {unit}
                </Text>
              )}
            </SortableDragExclusion>
          );
        })}
        <SortableDragExclusion>
          <Pressable
            style={styles.noteButton}
            onPress={handleToggleNote}
            accessibilityRole="button"
            accessibilityLabel={
              showsNote
                ? `Hide note for set ${setNumber} of ${exerciseName}`
                : `Add note to set ${setNumber} of ${exerciseName}`
            }
          >
            <Text
              variant="body"
              style={showsNote ? styles.noteGlyphActive : styles.noteGlyph}
              accessibilityElementsHidden
            >
              ✎
            </Text>
          </Pressable>
        </SortableDragExclusion>
        <Pressable
          onPress={handleRemove}
          hitSlop={REMOVE_HIT_SLOP}
          accessibilityRole="button"
          accessibilityLabel={`Remove set ${setNumber} of ${exerciseName}`}
        >
          <View style={styles.removeCircle}>
            <View style={styles.removeBar} />
          </View>
        </Pressable>
      </View>
      {showsNote ? (
        <SortableDragExclusion style={styles.noteField}>
          <TextInput
            style={styles.noteInput}
            value={set.notes}
            onChangeText={onChangeNotes}
            placeholder="Note"
            placeholderTextColor={colors.placeholderText}
            maxLength={WORKOUT_TEMPLATE_NOTES_MAX_LENGTH}
            multiline
            accessibilityLabel={`${exerciseName}, set ${setNumber}, note`}
          />
        </SortableDragExclusion>
      ) : null}
    </View>
  );
};
