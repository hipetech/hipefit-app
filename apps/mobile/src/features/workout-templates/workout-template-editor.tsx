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
import {
  ActionSheetIOS,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { Host } from '@expo/ui';
import { SortableList } from '@hipefit/sortable-list';
import { Stack } from 'expo-router';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useShallow } from 'zustand/react/shallow';

import { Text } from '@/components/text';
import { useAppColorScheme } from '@/hooks/use-app-color-scheme';
import { formatLongDate, toLocalDateId } from '@/lib/format';
import {
  hapticImpact,
  hapticLift,
  hapticSelection,
  hapticSuccess,
} from '@/lib/haptics';
import { useUserStore } from '@/stores/use-user-store';
import { useWorkoutTemplateDraftStore } from '@/stores/use-workout-template-draft-store';
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
 * Height assumed for a list item before it is measured: a single exercise card
 * with one set, summed from `template-card-styles.ts`,
 * `template-exercise-content.tsx`, and `template-set-row.tsx` at the default
 * Dynamic Type size. Not measured. A superset block is taller.
 */
const ESTIMATED_ROW_HEIGHT = 136;

/**
 * What the editor renders if the store holds no draft. `ExpandedOutlet`
 * unmounts the editor as soon as the provider goes inactive, so this guards a
 * render that should not occur rather than a state the user sees.
 */
const NO_DRAFT: WorkoutTemplateDraft = createWorkoutTemplateDraft();

const styles = StyleSheet.create({
  /** The background the form's fields and the exercise cards sit on. */
  screen: { flex: 1, backgroundColor: colors.systemBackground },
  fill: { flex: 1 },
  /**
   * A self-presenting overlay: the `BottomSheet` inside the `Host` draws
   * itself, so the host view takes no space in the layout.
   */
  sheetHost: { position: 'absolute' },
  listContent: { paddingBottom: 32 },
  header: {
    gap: 8,
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 4,
  },
  /**
   * The same opaque card the exercise rows draw, so the fields and the rows
   * read as one surface on the screen's background.
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
   * SwiftUI `.bordered` button. The footer is plain React Native list content
   * like the rows, and a SwiftUI `Button` here would need a `Host` island of
   * its own.
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

/** Module scope, so `SortableList` receives the same function every render. */
const keyBlock = (block: TemplateExerciseBlock): string => block.key;

/**
 * The workout template editor, the content of the route the template
 * accessory expands into: a React Native `SortableList` of exercises, with
 * Cancel, the title, and Save declared as the route's header. A gesture
 * minimizes it, popping the route and leaving the draft in its store: swiping
 * down after the pill zoomed it open, the edge swipe after the create panel
 * pushed it, or swiping down as a page sheet.
 * It takes no props and renders only inside `ExpandableAccessory.Provider`.
 *
 * The draft and the UI state that must survive minimizing (edited fields,
 * open notes, whether Save was pressed) live in `useWorkoutTemplateDraftStore`,
 * so the editor can unmount when minimized and remount unchanged. The save error,
 * the pending save, and which sheet is presented are local: they describe this
 * mount, not the draft. Store updates stay pure, so haptics fire in the
 * handlers. Field errors appear once the user has edited that field or
 * pressed Save.
 *
 * Header items, checked against expo-router 57.0.8
 * (`build/layouts/stack-utils/toolbar/`): `Stack.Toolbar` takes
 * `placement="left"` or `"right"` for the navigation bar (`"bottom"`, the
 * default, is the bottom toolbar), and its children are
 * `Stack.Toolbar.Button`s. Right items render in declaration order, leading to
 * trailing. A disabled Save is the button's `disabled` prop, which reaches the
 * `UIBarButtonItem` through `unstable_headerRightItems`.
 */
export const WorkoutTemplateEditor: React.FC = () => {
  const colorScheme = useAppColorScheme();
  // `metric` until the profile loads, which is the value a new profile is
  // provisioned with.
  const units = useUserStore(
    (state): UnitSystem => state.profile?.settings.units ?? 'metric'
  );

  const stored = useWorkoutTemplateDraftStore(
    useShallow((state) => ({
      draft: state.draft,
      isNameEdited: state.isNameEdited,
      editedExerciseKeys: state.editedExerciseKeys,
      openNoteKeys: state.openNoteKeys,
      didPressSave: state.didPressSave,
      isSaving: state.isSaving,
    }))
  );
  const {
    isNameEdited,
    editedExerciseKeys,
    openNoteKeys,
    didPressSave,
    isSaving,
  } = stored;
  const draft = stored.draft ?? NO_DRAFT;

  const updateStoredDraft = useWorkoutTemplateDraftStore(
    (state) => state.updateDraft
  );
  const markNameEdited = useWorkoutTemplateDraftStore(
    (state) => state.markNameEdited
  );
  const markExerciseEdited = useWorkoutTemplateDraftStore(
    (state) => state.markExerciseEdited
  );
  const toggleNote = useWorkoutTemplateDraftStore((state) => state.toggleNote);
  const discard = useWorkoutTemplateDraftStore((state) => state.discard);

  const [isPickerPresented, setIsPickerPresented] = useState(false);
  const [isDateSheetPresented, setIsDateSheetPresented] = useState(false);
  const [didFail, setDidFail] = useState(false);

  // A save can outlive the editor: minimizing unmounts it while the write is
  // pending. `isMounted` keeps that save from setting state or playing a
  // haptic with no editor on screen. The in-flight flag lives in the draft
  // store and is read synchronously, so it also rejects a second press that
  // lands before the disabled state reaches the native button, and a press in
  // an editor reopened during the write.
  const isMounted = useRef(true);

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  const errors = useMemo(() => validateWorkoutTemplateDraft(draft), [draft]);
  const canSave = !isSaving && !hasWorkoutTemplateDraftErrors(errors);

  /** Every edit clears a save error, as in the custom exercise form. */
  const updateDraft = useCallback(
    (update: (current: WorkoutTemplateDraft) => WorkoutTemplateDraft) => {
      updateStoredDraft(update);
      setDidFail(false);
    },
    [updateStoredDraft]
  );

  const handleNameChange = useCallback(
    (name: string) => {
      markNameEdited();
      updateDraft((current) => ({ ...current, name }));
    },
    [markNameEdited, updateDraft]
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

  // Discarding turns the provider inactive, and the provider pops the route,
  // so neither branch navigates.
  const handleCancel = useCallback(() => {
    const current = useWorkoutTemplateDraftStore.getState().draft;
    if (current === null || !hasUnsavedInput(current)) {
      discard();
      return;
    }
    ActionSheetIOS.showActionSheetWithOptions(
      {
        options: ['Discard Template', 'Keep Editing'],
        destructiveButtonIndex: 0,
        cancelButtonIndex: 1,
      },
      (index) => {
        if (index === 0) discard();
      }
    );
  }, [discard]);

  const save = useCallback(async () => {
    const {
      draft: current,
      isSaving: isAlreadySaving,
      setDidPressSave,
      setIsSaving,
    } = useWorkoutTemplateDraftStore.getState();
    if (current === null || isAlreadySaving) return;

    setDidPressSave(true);
    const input = toWorkoutTemplateInput(current, units);
    if (!input) return;

    setIsSaving(true);
    setDidFail(false);
    // A save that finishes after minimizing still clears the draft it wrote, so
    // the accessory does not offer a template that already exists. A draft
    // discarded during the write is left alone: by then the store may hold a
    // newer draft that this save did not write.
    let wasDiscarded = false;
    const unsubscribe = useWorkoutTemplateDraftStore.subscribe((state) => {
      if (state.draft === null) wasDiscarded = true;
    });
    try {
      await useWorkoutTemplateStore.getState().createWorkoutTemplate(input);
      if (isMounted.current) hapticSuccess();
      if (!wasDiscarded) discard();
    } catch (error) {
      console.error('[WorkoutTemplate] save', error);
      // Cleared in the store even when the editor is gone, so a reopened
      // editor can retry. A discarded draft has no flag left to clear.
      if (!wasDiscarded) setIsSaving(false);
      if (!isMounted.current) return;
      setDidFail(true);
    } finally {
      unsubscribe();
    }
  }, [discard, units]);

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
            onToggleNote={toggleNote}
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
          onToggleNote={toggleNote}
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
      handleUnlink,
      rowContext,
      toggleNote,
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
    <View style={styles.screen}>
      <Stack.Screen.Title>New Workout Template</Stack.Screen.Title>
      <Stack.Toolbar placement="left">
        <Stack.Toolbar.Button onPress={handleCancel}>
          Cancel
        </Stack.Toolbar.Button>
      </Stack.Toolbar>
      <Stack.Toolbar placement="right">
        <Stack.Toolbar.Button variant="done" disabled={!canSave} onPress={save}>
          Save
        </Stack.Toolbar.Button>
      </Stack.Toolbar>

      {/* Gesture Handler recognizes a gesture only beneath a native
          `GestureHandlerRootView`. The root layout mounts one, but as a
          page sheet the route is presented by its own view controller, so
          its views are not native descendants of that root. This subtree
          mounts its own root so the list's drag gesture is recognized. If the
          outer root would have served, a nested one is harmless. Not yet run
          on a device: if the block drag does not start here, check this
          first. */}
      <GestureHandlerRootView style={styles.fill}>
        {/* `automatic`, as on Exercises: the list is the screen's content
            under the navigation bar and above the home indicator, and the
            drag's edge scrolling stops at those insets. */}
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
          contentInsetAdjustmentBehavior="automatic"
          estimatedItemSize={ESTIMATED_ROW_HEIGHT}
          ListHeaderComponent={listHeader}
          ListFooterComponent={listFooter}
        />
      </GestureHandlerRootView>

      {/* Each sheet presents from its own `Host` island, as
          `custom-exercise-sheet.tsx` does, because the editor is plain React
          Native with no SwiftUI tree to render them in. */}
      <Host
        style={styles.sheetHost}
        pointerEvents="none"
        colorScheme={colorScheme}
      >
        <ExercisePickerSheet
          isPresented={isPickerPresented}
          onCancel={handleCancelPicker}
          onAdd={handleAddExercises}
        />
      </Host>
      <Host
        style={styles.sheetHost}
        pointerEvents="none"
        colorScheme={colorScheme}
      >
        <PlannedDateSheet
          isPresented={isDateSheetPresented}
          plannedDate={draft.plannedDate}
          onChange={handleChangePlannedDate}
          onClose={handleCloseDateSheet}
        />
      </Host>
    </View>
  );
};
