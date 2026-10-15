import type {
  TemplateExerciseBlock,
  TemplateSetField,
  WorkoutTemplateDraft,
} from './workout-template-draft';
import type { MergedExercise } from '@/features/exercises/exercise-catalogue';
import type { UnitSystem } from '@/lib/units';
import type { SortableListRenderItemInfo } from '@hipefit/sortable-list';
import type React from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import {
  Button,
  Group,
  HStack,
  RNHostView,
  Spacer,
  Text as SwiftUIText,
  VStack,
} from '@expo/ui/swift-ui';
import {
  disabled,
  font,
  frame,
  lineLimit,
  padding,
} from '@expo/ui/swift-ui/modifiers';
import { SortableList } from '@hipefit/sortable-list';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { Text } from '@/components/text';
import { formatLongDate, toLocalDateId } from '@/lib/format';
import {
  hapticImpact,
  hapticLift,
  hapticSelection,
  hapticSuccess,
} from '@/lib/haptics';
import { useUserStore } from '@/stores/use-user-store';
import { useWorkoutTemplateStore } from '@/stores/use-workout-template-store';
import { colors } from '@/theme/colors';

import { ExercisePickerSheet } from './exercise-picker-sheet';
import { PlannedDateSheet } from './planned-date-sheet';
import { TemplateExerciseRow } from './template-exercise-row';
import { TemplateSupersetBlock } from './template-superset-block';
import {
  addExercises,
  addSet,
  canLinkWithNext,
  createWorkoutTemplateDraft,
  editSetField,
  editSetNotes,
  editSupersetNotes,
  groupExerciseBlocks,
  hasUnsavedInput,
  hasWorkoutTemplateDraftErrors,
  linkWithNext,
  removeExercise,
  removeSet,
  reorderBlocks,
  reorderSupersetMembers,
  toWorkoutTemplateInput,
  unlinkExercise,
  validateWorkoutTemplateDraft,
  WORKOUT_TEMPLATE_NAME_MAX_LENGTH,
} from './workout-template-draft';

const SAVE_ERROR_MESSAGE =
  "Couldn't save the workout template. Check your connection and try again.";
const EMPTY_EXERCISES_MESSAGE = 'Add exercises to build this template.';

/**
 * The header row stands in for a navigation bar: the sheet has no navigation
 * stack to draw one. The top inset clears the drag indicator.
 */
const HEADER_MODIFIERS = [padding({ horizontal: 16, top: 20, bottom: 8 })];

const TITLE_MODIFIERS = [font({ textStyle: 'headline' }), lineLimit(1)];

const SAVE_LABEL_MODIFIERS = [font({ textStyle: 'body', weight: 'semibold' })];

/**
 * `BottomSheet` draws itself in place as `Rectangle().hidden()` carrying the
 * `.sheet` modifier (`BottomSheetView.swift` at @expo/ui 57.0.7). A hidden
 * view keeps its layout, and a `Rectangle` takes all the space it is offered,
 * so in this `VStack` the picker's anchor would split the height below the
 * header with the hosted list. A zero frame keeps it out of the layout, and
 * the `.sheet` on it still presents.
 */
const PICKER_ANCHOR_MODIFIERS = [frame({ width: 0, height: 0 })];

/**
 * Height assumed for a list item before it is measured: a single exercise card
 * with one set, summed from `template-card-styles.ts`,
 * `template-exercise-content.tsx`, and `template-set-row.tsx` at the default
 * Dynamic Type size. Not measured. A superset block is taller.
 */
const ESTIMATED_ROW_HEIGHT = 136;

const styles = StyleSheet.create({
  fill: { flex: 1 },
  listContent: { paddingBottom: 32 },
  header: {
    gap: 8,
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 4,
  },
  /**
   * The same opaque card the exercise rows draw, so the fields and the rows
   * read as one surface on the sheet's background.
   */
  field: {
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: colors.secondarySystemBackground,
  },
  /**
   * `TextInput` has no `dynamicTypeRamp`, so it scales by React Native's flat
   * multiplier rather than the `body` ramp `Text` follows. The size matches
   * the `body` variant at the default Dynamic Type size, as in
   * `template-set-row.tsx`.
   */
  input: {
    paddingVertical: 12,
    fontSize: 17,
    color: colors.label,
  },
  fieldError: {
    paddingHorizontal: 16,
    color: colors.systemRed,
  },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 44,
  },
  dateLabel: {
    flex: 1,
    color: colors.label,
  },
  dateValue: {
    color: colors.accent,
  },
  dateValueEmpty: {
    color: colors.secondaryLabel,
  },
  sectionLabel: {
    paddingHorizontal: 16,
    paddingTop: 12,
    color: colors.secondaryLabel,
  },
  footer: {
    gap: 12,
    paddingHorizontal: 16,
    paddingTop: 12,
    alignItems: 'center',
  },
  centeredText: { textAlign: 'center' },
  emptyMessage: { color: colors.secondaryLabel },
  /**
   * A centered capsule in the system fill with an accent label, the look of a
   * SwiftUI `.bordered` button. A SwiftUI `Button` cannot be used here: the
   * footer renders inside the `RNHostView`, and a `Host` there would nest.
   */
  addExercises: {
    minHeight: 44,
    paddingHorizontal: 20,
    justifyContent: 'center',
    borderRadius: 22,
    backgroundColor: colors.tertiarySystemFill,
  },
  addExercisesPressed: { opacity: 0.6 },
  addExercisesLabel: { color: colors.accent },
  error: { color: colors.systemRed },
});

/** What each row reads besides its item. Passed as `extraData`, so rows re-render when it changes. */
interface RowContext {
  draft: WorkoutTemplateDraft;
  errors: Record<string, string>;
  units: UnitSystem;
  didPressSave: boolean;
  editedExerciseKeys: ReadonlySet<string>;
  openNoteKeys: ReadonlySet<string>;
}

const NO_EDITED_EXERCISES: ReadonlySet<string> = new Set();
const NO_OPEN_NOTES: ReadonlySet<string> = new Set();

/** Module scope, so `SortableList` receives the same function every render. */
const keyBlock = (block: TemplateExerciseBlock): string => block.key;

export interface WorkoutTemplateFormProps {
  /** Dismisses the sheet. Called by Cancel, and after a save that succeeded. */
  onClose: () => void;
  /**
   * Reports whether the sheet must refuse an interactive dismissal: `true`
   * while the draft has any input or a save is in flight.
   */
  onDismissLockChange: (isLocked: boolean) => void;
}

/**
 * The workout template editor: a SwiftUI header row with Cancel, the title,
 * and Save, above a React Native `SortableList` of exercises. Host-less. It
 * renders inside the `BottomSheet` of `workout-template-sheet.tsx`, which
 * mounts it once per presentation, so every presentation starts from an empty
 * draft.
 *
 * The draft is one `useState` over the pure operations in
 * `workout-template-draft.ts`. Updaters stay pure because React may run them
 * twice, so haptics fire in the handlers. Field errors appear once the user
 * has edited that field or pressed Save.
 */
export const WorkoutTemplateForm: React.FC<WorkoutTemplateFormProps> = ({
  onClose,
  onDismissLockChange,
}) => {
  // `metric` until the profile loads, which is the value a new profile is
  // provisioned with.
  const units = useUserStore(
    (state): UnitSystem => state.profile?.settings.units ?? 'metric'
  );

  const [draft, setDraft] = useState<WorkoutTemplateDraft>(
    createWorkoutTemplateDraft
  );
  const [isNameEdited, setIsNameEdited] = useState(false);
  const [editedExerciseKeys, setEditedExerciseKeys] =
    useState<ReadonlySet<string>>(NO_EDITED_EXERCISES);
  // Which note fields the user has opened, by set key or superset id. UI
  // state, not draft: an empty note that is closed again leaves no trace.
  const [openNoteKeys, setOpenNoteKeys] =
    useState<ReadonlySet<string>>(NO_OPEN_NOTES);
  const [didPressSave, setDidPressSave] = useState(false);
  const [isPickerPresented, setIsPickerPresented] = useState(false);
  const [isDateSheetPresented, setIsDateSheetPresented] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [didFail, setDidFail] = useState(false);

  // A save can outlive the form: Cancel dismisses while the write is pending.
  // `isMounted` stops that save from closing a sheet the user has since
  // reopened. `isSavingRef` rejects a second press that lands before the
  // disabled state reaches the native button.
  const isMounted = useRef(true);
  const isSavingRef = useRef(false);

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  const errors = useMemo(() => validateWorkoutTemplateDraft(draft), [draft]);
  const canSave = !isSaving && !hasWorkoutTemplateDraftErrors(errors);
  const isDismissLocked = isSaving || hasUnsavedInput(draft);

  useEffect(() => {
    onDismissLockChange(isDismissLocked);
  }, [isDismissLocked, onDismissLockChange]);

  /** Every edit clears a save error, as in the custom exercise form. */
  const updateDraft = useCallback(
    (update: (current: WorkoutTemplateDraft) => WorkoutTemplateDraft) => {
      setDraft(update);
      setDidFail(false);
    },
    []
  );

  const markExerciseEdited = useCallback((exerciseKey: string) => {
    setEditedExerciseKeys((current) =>
      current.has(exerciseKey) ? current : new Set(current).add(exerciseKey)
    );
  }, []);

  const handleNameChange = useCallback(
    (name: string) => {
      setIsNameEdited(true);
      updateDraft((current) => ({ ...current, name }));
    },
    [updateDraft]
  );

  // The rows play their own selection haptic for Add Set, removing a set, and
  // Remove Exercise, so those handlers fire none.
  const handleAddSet = useCallback(
    (exerciseKey: string) => {
      updateDraft((current) => addSet(current, exerciseKey));
    },
    [updateDraft]
  );

  const handleRemoveSet = useCallback(
    (exerciseKey: string, setKey: string) => {
      markExerciseEdited(exerciseKey);
      updateDraft((current) => removeSet(current, exerciseKey, setKey));
    },
    [markExerciseEdited, updateDraft]
  );

  const handleChangeSetField = useCallback(
    (
      exerciseKey: string,
      setKey: string,
      field: TemplateSetField,
      value: string
    ) => {
      markExerciseEdited(exerciseKey);
      updateDraft((current) =>
        editSetField(current, exerciseKey, setKey, field, value)
      );
    },
    [markExerciseEdited, updateDraft]
  );

  const handleToggleNote = useCallback((noteKey: string) => {
    setOpenNoteKeys((current) => {
      const next = new Set(current);
      if (!next.delete(noteKey)) next.add(noteKey);
      return next;
    });
  }, []);

  const handleChangeSetNotes = useCallback(
    (exerciseKey: string, setKey: string, notes: string) => {
      updateDraft((current) =>
        editSetNotes(current, exerciseKey, setKey, notes)
      );
    },
    [updateDraft]
  );

  const handleChangeSupersetNotes = useCallback(
    (supersetId: string, notes: string) => {
      updateDraft((current) => editSupersetNotes(current, supersetId, notes));
    },
    [updateDraft]
  );

  // The row offers each superset action only when it applies, so the draft
  // always changes and the haptic always matches a change.
  const handleLinkWithNext = useCallback(
    (exerciseKey: string) => {
      hapticSelection();
      updateDraft((current) => linkWithNext(current, exerciseKey));
    },
    [updateDraft]
  );

  const handleUnlink = useCallback(
    (exerciseKey: string) => {
      hapticSelection();
      updateDraft((current) => unlinkExercise(current, exerciseKey));
    },
    [updateDraft]
  );

  const handleRemove = useCallback(
    (exerciseKey: string) => {
      updateDraft((current) => removeExercise(current, exerciseKey));
    },
    [updateDraft]
  );

  const handleReorder = useCallback(
    (ordered: TemplateExerciseBlock[]) => {
      updateDraft((current) => reorderBlocks(current, ordered));
    },
    [updateDraft]
  );

  const handleReorderMembers = useCallback(
    (supersetId: string, exerciseKey: string, toIndex: number) => {
      updateDraft((current) =>
        reorderSupersetMembers(current, supersetId, exerciseKey, toIndex)
      );
    },
    [updateDraft]
  );

  // Opening the calendar with no date set plans the template for today, so the
  // highlighted day is also the stored one. Remove Date undoes it.
  const handleOpenDateSheet = useCallback(() => {
    hapticImpact();
    updateDraft((current) =>
      current.plannedDate === null
        ? { ...current, plannedDate: toLocalDateId(new Date()) }
        : current
    );
    setIsDateSheetPresented(true);
  }, [updateDraft]);

  const handleChangePlannedDate = useCallback(
    (plannedDate: string | null) => {
      updateDraft((current) => ({ ...current, plannedDate }));
    },
    [updateDraft]
  );

  const handleCloseDateSheet = useCallback(() => {
    setIsDateSheetPresented(false);
  }, []);

  const handleOpenPicker = useCallback(() => {
    hapticImpact();
    setIsPickerPresented(true);
  }, []);

  const handleCancelPicker = useCallback(() => {
    setIsPickerPresented(false);
  }, []);

  const handleAddExercises = useCallback(
    (exercises: MergedExercise[]) => {
      setIsPickerPresented(false);
      updateDraft((current) => addExercises(current, exercises));
    },
    [updateDraft]
  );

  const save = useCallback(async () => {
    if (isSavingRef.current) return;

    setDidPressSave(true);
    const input = toWorkoutTemplateInput(draft, units);
    if (!input) return;

    isSavingRef.current = true;
    setIsSaving(true);
    setDidFail(false);
    try {
      await useWorkoutTemplateStore.getState().createWorkoutTemplate(input);
      if (!isMounted.current) return;
      hapticSuccess();
      onClose();
    } catch (error) {
      console.error('[WorkoutTemplate] save', error);
      isSavingRef.current = false;
      if (!isMounted.current) return;
      setIsSaving(false);
      setDidFail(true);
    }
  }, [draft, onClose, units]);

  const rowContext = useMemo<RowContext>(
    () => ({
      draft,
      errors: errors.exercises,
      units,
      didPressSave,
      editedExerciseKeys,
      openNoteKeys,
    }),
    [
      didPressSave,
      draft,
      editedExerciseKeys,
      errors.exercises,
      openNoteKeys,
      units,
    ]
  );

  const blocks = useMemo(
    () => groupExerciseBlocks(draft.exercises),
    [draft.exercises]
  );

  // `SortableList` calls this a second time for the lifted copy, so it reads
  // only its arguments and `rowContext`, which travels as `extraData`.
  const renderItem = useCallback(
    ({ item }: SortableListRenderItemInfo<TemplateExerciseBlock>) => {
      const getError = (exerciseKey: string): string | null =>
        rowContext.didPressSave ||
        rowContext.editedExerciseKeys.has(exerciseKey)
          ? (rowContext.errors[exerciseKey] ?? null)
          : null;
      const getCanLinkWithNext = (exerciseKey: string): boolean =>
        canLinkWithNext(rowContext.draft, exerciseKey);
      const exercise = item.exercises[0];

      if (item.supersetId === null && exercise !== undefined) {
        return (
          <TemplateExerciseRow
            exercise={exercise}
            units={rowContext.units}
            error={getError(exercise.key)}
            canLinkWithNext={getCanLinkWithNext(exercise.key)}
            onAddSet={handleAddSet}
            onRemoveSet={handleRemoveSet}
            onChangeSetField={handleChangeSetField}
            openNoteKeys={rowContext.openNoteKeys}
            onToggleNote={handleToggleNote}
            onChangeSetNotes={handleChangeSetNotes}
            onLinkWithNext={handleLinkWithNext}
            onUnlink={handleUnlink}
            onRemove={handleRemove}
          />
        );
      }
      return (
        <TemplateSupersetBlock
          block={item}
          units={rowContext.units}
          getError={getError}
          getCanLinkWithNext={getCanLinkWithNext}
          supersetNotes={
            item.supersetId === null
              ? ''
              : (rowContext.draft.supersetNotes[item.supersetId] ?? '')
          }
          onChangeSupersetNotes={handleChangeSupersetNotes}
          onReorderMembers={handleReorderMembers}
          onAddSet={handleAddSet}
          onRemoveSet={handleRemoveSet}
          onChangeSetField={handleChangeSetField}
          openNoteKeys={rowContext.openNoteKeys}
          onToggleNote={handleToggleNote}
          onChangeSetNotes={handleChangeSetNotes}
          onLinkWithNext={handleLinkWithNext}
          onUnlink={handleUnlink}
          onRemove={handleRemove}
        />
      );
    },
    [
      handleAddSet,
      handleChangeSetField,
      handleChangeSetNotes,
      handleChangeSupersetNotes,
      handleLinkWithNext,
      handleRemove,
      handleRemoveSet,
      handleReorderMembers,
      handleToggleNote,
      handleUnlink,
      rowContext,
    ]
  );

  const nameError = isNameEdited || didPressSave ? errors.name : null;

  const listHeader = (
    <View style={styles.header}>
      <View style={styles.field}>
        <TextInput
          style={styles.input}
          value={draft.name}
          onChangeText={handleNameChange}
          placeholder="Template name"
          placeholderTextColor={colors.placeholderText}
          maxLength={WORKOUT_TEMPLATE_NAME_MAX_LENGTH}
          autoCapitalize="words"
          clearButtonMode="while-editing"
          accessibilityLabel="Name"
        />
      </View>
      {nameError === null ? null : (
        <Text variant="footnote" style={styles.fieldError}>
          {nameError}
        </Text>
      )}
      <Pressable
        style={[styles.field, styles.dateRow]}
        onPress={handleOpenDateSheet}
        accessibilityRole="button"
        accessibilityLabel={
          draft.plannedDate === null
            ? 'Planned date, none'
            : `Planned date, ${formatLongDate(draft.plannedDate)}`
        }
        accessibilityHint="Opens a calendar"
      >
        <Text style={styles.dateLabel}>Planned date</Text>
        <Text
          style={
            draft.plannedDate === null
              ? styles.dateValueEmpty
              : styles.dateValue
          }
        >
          {draft.plannedDate === null
            ? 'None'
            : formatLongDate(draft.plannedDate)}
        </Text>
      </Pressable>
      <Text
        variant="footnote"
        style={styles.sectionLabel}
        accessibilityRole="header"
      >
        Exercises
      </Text>
    </View>
  );

  // An empty draft explains itself instead of showing the count error. A
  // draft over the limit shows it as soon as the exercises are added.
  const listFooter = (
    <View style={styles.footer}>
      {draft.exercises.length === 0 ? (
        <Text
          variant="subheadline"
          style={[styles.centeredText, styles.emptyMessage]}
        >
          {EMPTY_EXERCISES_MESSAGE}
        </Text>
      ) : errors.exerciseCount === null ? null : (
        <Text variant="footnote" style={[styles.centeredText, styles.error]}>
          {errors.exerciseCount}
        </Text>
      )}
      <Pressable
        style={({ pressed }) => [
          styles.addExercises,
          pressed && styles.addExercisesPressed,
        ]}
        onPress={handleOpenPicker}
        accessibilityRole="button"
      >
        <Text variant="headline" style={styles.addExercisesLabel}>
          Add Exercises
        </Text>
      </Pressable>
      {didFail ? (
        <Text variant="footnote" style={[styles.centeredText, styles.error]}>
          {SAVE_ERROR_MESSAGE}
        </Text>
      ) : null}
    </View>
  );

  return (
    <VStack spacing={0}>
      <HStack modifiers={HEADER_MODIFIERS}>
        <Button label="Cancel" onPress={onClose} />
        <Spacer />
        <SwiftUIText modifiers={TITLE_MODIFIERS}>
          New Workout Template
        </SwiftUIText>
        <Spacer />
        <Button onPress={save} modifiers={[disabled(!canSave)]}>
          <SwiftUIText modifiers={SAVE_LABEL_MODIFIERS}>Save</SwiftUIText>
        </Button>
      </HStack>

      {/* No `matchContents`: the list is virtualized and owns its scrolling,
          so it must fill the height the header leaves rather than report a
          content height. Without `matchContents`, `RNHostView.swift` at
          @expo/ui 57.0.7 frames the hosted view with an infinite max width and
          height and reports that size to Yoga, so it fills the `VStack` with
          no explicit frame (`RNHostView` takes no `modifiers` either).
          No `pointerEvents="none"` either: the hosted tree is interactive, and
          the header's SwiftUI buttons sit outside it, so the touch handler
          conflict `docs/app/ui.md` records does not reach them. */}
      <RNHostView>
        {/* Gesture Handler recognizes a gesture only beneath a native
            `GestureHandlerRootView`. The one in `app/_layout.tsx` is not an
            ancestor of this view: the sheet's content is reparented into the
            sheet's own hosting controller. This subtree mounts its own root so
            the list's drag gesture is recognized. */}
        <GestureHandlerRootView style={styles.fill}>
          <SortableList
            data={blocks}
            keyExtractor={keyBlock}
            renderItem={renderItem}
            onReorder={handleReorder}
            onLift={hapticLift}
            onSlotChange={hapticSelection}
            extraData={rowContext}
            style={styles.fill}
            contentContainerStyle={styles.listContent}
            estimatedItemSize={ESTIMATED_ROW_HEIGHT}
            ListHeaderComponent={listHeader}
            ListFooterComponent={listFooter}
          />
        </GestureHandlerRootView>
      </RNHostView>

      {/* Rendered in the form's SwiftUI tree, so the exercise picker and the
          date sheet present over the editor sheet. Neither opens a `Host`. */}
      <Group modifiers={PICKER_ANCHOR_MODIFIERS}>
        <ExercisePickerSheet
          isPresented={isPickerPresented}
          onCancel={handleCancelPicker}
          onAdd={handleAddExercises}
        />
      </Group>
      <Group modifiers={PICKER_ANCHOR_MODIFIERS}>
        <PlannedDateSheet
          isPresented={isDateSheetPresented}
          plannedDate={draft.plannedDate}
          onChange={handleChangePlannedDate}
          onClose={handleCloseDateSheet}
        />
      </Group>
    </VStack>
  );
};
