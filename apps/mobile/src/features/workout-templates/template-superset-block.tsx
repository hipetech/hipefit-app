import type { TemplateExerciseContentProps } from './template-exercise-content';
import type { TemplateExerciseBlock } from './workout-template-draft';
import type React from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import { SortableDragExclusion } from '@hipefit/sortable-list';

import { Text } from '@/components/text';
import { hapticSelection } from '@/lib/haptics';
import { colors } from '@/theme/colors';

import { templateCardStyles } from './template-card-styles';
import { TemplateExerciseContent } from './template-exercise-content';
import { WORKOUT_TEMPLATE_NOTES_MAX_LENGTH } from './workout-template-draft';

const styles = StyleSheet.create({
  captionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingRight: 10,
  },
  caption: {
    flex: 1,
    paddingTop: 10,
    color: colors.secondaryLabel,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  noteButton: {
    width: 36,
    height: 36,
    marginTop: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  noteGlyph: {
    color: colors.secondaryLabel,
  },
  noteGlyphActive: {
    color: colors.accent,
  },
  noteField: {
    marginTop: 4,
    marginBottom: 4,
    marginRight: 10,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: colors.tertiarySystemBackground,
  },
  noteInput: {
    paddingVertical: 8,
    fontSize: 15,
    color: colors.label,
  },
  divider: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.separator,
  },
});

export interface TemplateSupersetBlockProps extends Omit<
  TemplateExerciseContentProps,
  'exercise' | 'error' | 'canLinkWithNext' | 'move'
> {
  /** A block with a superset id and at least two exercises. */
  block: TemplateExerciseBlock;
  /** The error line of each member, or `null` to show none. */
  getError: (exerciseKey: string) => string | null;
  /** Whether Superset with Next applies to each member. */
  getCanLinkWithNext: (exerciseKey: string) => boolean;
  /** The superset's note as typed. */
  supersetNotes: string;
  /** Called with the superset's note as the user types it. */
  onChangeSupersetNotes: (supersetId: string, notes: string) => void;
  /** Moves a member to an index counted inside its superset. */
  onReorderMembers: (
    supersetId: string,
    exerciseKey: string,
    toIndex: number
  ) => void;
}

/**
 * A superset in the template editor's list: one card with a Superset caption,
 * a note button beside it, and its exercises separated by dividers. The note
 * field shows below the caption once opened, and always when the superset has
 * a note. The editor's list moves the block as a whole; each member's up and
 * down arrows move it within the block.
 *
 * Plain React Native, for the same reason as the exercise row: it renders
 * inside an `RNHostView` in the sheet's `Host`.
 */
export const TemplateSupersetBlock: React.FC<TemplateSupersetBlockProps> = ({
  block,
  getError,
  getCanLinkWithNext,
  supersetNotes,
  onChangeSupersetNotes,
  onReorderMembers,
  ...contentProps
}) => {
  const { key, supersetId, exercises } = block;
  const { openNoteKeys, onToggleNote } = contentProps;
  const showsNote = openNoteKeys.has(key) || supersetNotes.trim().length > 0;

  const handleToggleNote = (): void => {
    hapticSelection();
    onToggleNote(key);
  };

  const moveMember = (exerciseKey: string, toIndex: number): void => {
    if (supersetId === null) return;
    hapticSelection();
    onReorderMembers(supersetId, exerciseKey, toIndex);
  };

  return (
    <View style={templateCardStyles.item}>
      <View style={templateCardStyles.card}>
        <View style={styles.captionRow}>
          <Text variant="footnote" style={styles.caption}>
            Superset
          </Text>
          <SortableDragExclusion>
            <Pressable
              style={styles.noteButton}
              onPress={handleToggleNote}
              accessibilityRole="button"
              accessibilityLabel={
                showsNote ? 'Hide superset note' : 'Add superset note'
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
        </View>
        {showsNote && supersetId !== null ? (
          <SortableDragExclusion style={styles.noteField}>
            <TextInput
              style={styles.noteInput}
              value={supersetNotes}
              onChangeText={(notes) => onChangeSupersetNotes(supersetId, notes)}
              placeholder="Superset note"
              placeholderTextColor={colors.placeholderText}
              maxLength={WORKOUT_TEMPLATE_NOTES_MAX_LENGTH}
              multiline
              accessibilityLabel="Superset note"
            />
          </SortableDragExclusion>
        ) : null}
        {exercises.map((exercise, index) => (
          <View key={exercise.key} style={index > 0 && styles.divider}>
            <TemplateExerciseContent
              {...contentProps}
              exercise={exercise}
              error={getError(exercise.key)}
              canLinkWithNext={getCanLinkWithNext(exercise.key)}
              move={{
                canMoveUp: index > 0,
                canMoveDown: index < exercises.length - 1,
                onMoveUp: () => moveMember(exercise.key, index - 1),
                onMoveDown: () => moveMember(exercise.key, index + 1),
              }}
            />
          </View>
        ))}
      </View>
    </View>
  );
};
