import type {
  TemplateExerciseDraft,
  TemplateSetField,
} from './workout-template-draft';
import type { UnitSystem } from '@/lib/units';
import type React from 'react';
import { ActionSheetIOS, Pressable, StyleSheet, View } from 'react-native';
import { SortableDragExclusion } from '@hipefit/sortable-list';

import { Text } from '@/components/text';
import { hapticSelection } from '@/lib/haptics';
import { colors } from '@/theme/colors';

import { TemplateSetRow } from './template-set-row';

/** Right inset of the set rows, which centres the remove controls under the action button. */
const SETS_TRAILING_INSET = 10;

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  name: {
    flex: 1,
    paddingVertical: 10,
  },
  moveButton: {
    width: 36,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  moveGlyph: {
    color: colors.accent,
  },
  moveGlyphDisabled: {
    color: colors.tertiaryLabel,
  },
  controls: {
    flexDirection: 'row',
  },
  actionButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionGlyph: {
    color: colors.accent,
  },
  sets: {
    gap: 8,
    marginRight: SETS_TRAILING_INSET,
  },
  addSet: {
    alignSelf: 'flex-start',
    minHeight: 44,
    justifyContent: 'center',
  },
  addSetLabel: {
    color: colors.accent,
  },
  error: {
    paddingBottom: 8,
    marginRight: SETS_TRAILING_INSET,
    color: colors.systemRed,
  },
});

/** Up and down controls for a superset member, which moves only within its superset. */
export interface TemplateExerciseMove {
  canMoveUp: boolean;
  canMoveDown: boolean;
  onMoveUp: () => void;
  onMoveDown: () => void;
}

interface ExerciseAction {
  title: string;
  run: () => void;
}

export interface TemplateExerciseContentProps {
  /** The exercise and its sets, as the draft holds them. */
  exercise: TemplateExerciseDraft;
  /** The user's unit system, which decides the set rows' unit labels. */
  units: UnitSystem;
  /** The exercise's error line, or `null` to show none. */
  error: string | null;
  /** Whether Superset with Next applies, as `canLinkWithNext` reports it. */
  canLinkWithNext: boolean;
  /** Up and down arrows beside the action button. Only superset members pass them. */
  move?: TemplateExerciseMove;
  /** Appends a set to the exercise with this key. */
  onAddSet: (exerciseKey: string) => void;
  /** Removes a set from the exercise with this key. */
  onRemoveSet: (exerciseKey: string, setKey: string) => void;
  /** Called with a set field's new text as the user types it. */
  onChangeSetField: (
    exerciseKey: string,
    setKey: string,
    field: TemplateSetField,
    value: string
  ) => void;
  /** Keys of the sets and supersets whose note field the user has opened. */
  openNoteKeys: ReadonlySet<string>;
  /** Opens or closes the note field of the set or superset with this key. */
  onToggleNote: (noteKey: string) => void;
  /** Called with a set's note as the user types it. */
  onChangeSetNotes: (
    exerciseKey: string,
    setKey: string,
    notes: string
  ) => void;
  /** Merges the exercise's block with the next block into a superset. */
  onLinkWithNext: (exerciseKey: string) => void;
  /** Takes the exercise with this key out of its superset. */
  onUnlink: (exerciseKey: string) => void;
  /** Removes the exercise with this key from the template. */
  onRemove: (exerciseKey: string) => void;
}

/**
 * One exercise's content in the template editor: its name, its sets, Add Set,
 * its error line, an action button, and for a superset member up and down
 * arrows. It draws no card: a single exercise
 * gets its card from `template-exercise-row.tsx`, and superset members share
 * the card of `template-superset-block.tsx`.
 *
 * Plain React Native, inside a row of the editor's `SortableList`. It owns no
 * state and
 * renders only from its props, because `SortableList` draws the lifted item a
 * second time.
 */
export const TemplateExerciseContent: React.FC<
  TemplateExerciseContentProps
> = ({
  exercise,
  units,
  error,
  canLinkWithNext,
  move,
  onAddSet,
  onRemoveSet,
  onChangeSetField,
  openNoteKeys,
  onToggleNote,
  onChangeSetNotes,
  onLinkWithNext,
  onUnlink,
  onRemove,
}) => {
  const isInSuperset = exercise.supersetId !== null;

  const handleAddSet = (): void => {
    hapticSelection();
    onAddSet(exercise.key);
  };

  /** Offers only the actions that apply. Remove Exercise is always last and destructive. */
  const handleOpenActions = (): void => {
    const actions: ExerciseAction[] = [];
    if (canLinkWithNext) {
      actions.push({
        title: 'Superset with Next',
        run: () => onLinkWithNext(exercise.key),
      });
    }
    if (isInSuperset) {
      actions.push({
        title: 'Remove from Superset',
        run: () => onUnlink(exercise.key),
      });
    }
    actions.push({
      title: 'Remove Exercise',
      run: () => {
        hapticSelection();
        onRemove(exercise.key);
      },
    });

    ActionSheetIOS.showActionSheetWithOptions(
      {
        title: exercise.name,
        options: [...actions.map((action) => action.title), 'Cancel'],
        cancelButtonIndex: actions.length,
        destructiveButtonIndex: actions.length - 1,
      },
      (index) => actions[index]?.run()
    );
  };

  return (
    <View>
      <View style={styles.header}>
        <Text
          variant="headline"
          style={styles.name}
          accessibilityRole="header"
          accessibilityLabel={
            isInSuperset ? `${exercise.name}, in a superset` : exercise.name
          }
        >
          {exercise.name}
        </Text>
        <SortableDragExclusion style={styles.controls}>
          {move === undefined ? null : (
            <>
              <Pressable
                style={styles.moveButton}
                onPress={move.onMoveUp}
                disabled={!move.canMoveUp}
                accessibilityRole="button"
                accessibilityLabel={`Move ${exercise.name} up`}
                accessibilityState={{ disabled: !move.canMoveUp }}
              >
                <Text
                  variant="title3"
                  style={
                    move.canMoveUp ? styles.moveGlyph : styles.moveGlyphDisabled
                  }
                  accessibilityElementsHidden
                >
                  ↑
                </Text>
              </Pressable>
              <Pressable
                style={styles.moveButton}
                onPress={move.onMoveDown}
                disabled={!move.canMoveDown}
                accessibilityRole="button"
                accessibilityLabel={`Move ${exercise.name} down`}
                accessibilityState={{ disabled: !move.canMoveDown }}
              >
                <Text
                  variant="title3"
                  style={
                    move.canMoveDown
                      ? styles.moveGlyph
                      : styles.moveGlyphDisabled
                  }
                  accessibilityElementsHidden
                >
                  ↓
                </Text>
              </Pressable>
            </>
          )}
          <Pressable
            style={styles.actionButton}
            onPress={handleOpenActions}
            accessibilityRole="button"
            accessibilityLabel="Exercise actions"
            accessibilityHint={`Shows actions for ${exercise.name}`}
          >
            <Text
              variant="title3"
              style={styles.actionGlyph}
              accessibilityElementsHidden
            >
              ⋯
            </Text>
          </Pressable>
        </SortableDragExclusion>
      </View>
      <View style={styles.sets}>
        {exercise.sets.map((set, index) => (
          <TemplateSetRow
            key={set.key}
            set={set}
            setNumber={index + 1}
            type={exercise.type}
            exerciseName={exercise.name}
            units={units}
            onChangeField={(field, value) =>
              onChangeSetField(exercise.key, set.key, field, value)
            }
            isNoteOpen={openNoteKeys.has(set.key)}
            onToggleNote={() => onToggleNote(set.key)}
            onChangeNotes={(notes) =>
              onChangeSetNotes(exercise.key, set.key, notes)
            }
            onRemove={() => onRemoveSet(exercise.key, set.key)}
          />
        ))}
      </View>
      <Pressable
        style={styles.addSet}
        onPress={handleAddSet}
        accessibilityRole="button"
        accessibilityLabel={`Add set to ${exercise.name}`}
      >
        <Text variant="subheadline" style={styles.addSetLabel}>
          Add Set
        </Text>
      </Pressable>
      {error === null ? null : (
        <Text variant="footnote" style={styles.error}>
          {error}
        </Text>
      )}
    </View>
  );
};
