import type { ExerciseType, Ref } from '@hipefit/schemas';
import type React from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Button,
  HStack,
  List,
  Picker,
  Section,
  Spacer,
  Text,
  TextField,
  useNativeState,
  VStack,
} from '@expo/ui/swift-ui';
import {
  disabled,
  font,
  foregroundStyle,
  lineLimit,
  listRowBackground,
  padding,
  pickerStyle,
  scrollContentBackground,
  tag,
  textInputAutocapitalization,
} from '@expo/ui/swift-ui/modifiers';

import { hapticSelection, hapticSuccess } from '@/lib/haptics';
import { useExerciseStore } from '@/stores/use-exercise-store';
import { colors } from '@/theme/colors';
import { mods } from '@/theme/modifiers';

import { CustomExerciseEquipmentRow } from './custom-exercise-equipment-row';
import {
  CUSTOM_EXERCISE_DESCRIPTION_MAX_LENGTH,
  CUSTOM_EXERCISE_NAME_MAX_LENGTH,
  DEFAULT_EXERCISE_TYPE,
  EXERCISE_TYPE_OPTIONS,
  hasUnsavedInput,
  NO_CATEGORY_TAG,
  resolveCategoryRef,
  toCustomExerciseFields,
  toggleEquipmentRef,
} from './custom-exercise-form-state';

const NAME_HELP_MESSAGE = 'Required.';
const DESCRIPTION_HELP_MESSAGE = 'Optional.';
const CATEGORY_HELP_MESSAGE = 'Required.';
const CATEGORY_UNAVAILABLE_MESSAGE =
  'Categories are unavailable, so the exercise cannot be saved. Try again later.';
const EQUIPMENT_HELP_MESSAGE = 'Optional.';
const SAVE_ERROR_MESSAGE =
  "Couldn't save the exercise. Check your connection and try again.";

/**
 * The header row stands in for a navigation bar: the sheet has no navigation
 * stack to draw one. The top inset clears the drag indicator.
 */
const HEADER_MODIFIERS = [padding({ horizontal: 16, top: 20, bottom: 8 })];

/**
 * The grouped list without its own page background. `insetGrouped` paints an
 * opaque `systemGroupedBackground` behind the rows, which would cover the
 * sheet's translucent material. Inlined, not added to `mods.listInsetGrouped`,
 * because every other grouped list is a full screen that needs that background.
 */
const LIST_MODIFIERS = [
  ...mods.listInsetGrouped,
  scrollContentBackground('hidden'),
];

/**
 * Row fill for every section. With the list's page background hidden, the
 * default row color (`secondarySystemGroupedBackground`) is white in light mode
 * and disappears against the sheet once it turns opaque near full height. A
 * translucent system fill reads as a card on both the opaque sheet and the
 * translucent one.
 */
const SECTION_MODIFIERS = [listRowBackground(colors.tertiarySystemFill)];

const TITLE_MODIFIERS = [font({ textStyle: 'headline' }), lineLimit(1)];

const SAVE_LABEL_MODIFIERS = [font({ textStyle: 'body', weight: 'semibold' })];

const NAME_FIELD_MODIFIERS = [textInputAutocapitalization('words')];

const DESCRIPTION_FIELD_MODIFIERS = [
  textInputAutocapitalization('sentences'),
  lineLimit(5),
];

const ERROR_TEXT_MODIFIERS = [
  font({ textStyle: 'footnote' }),
  foregroundStyle(colors.systemRed),
];

const SEGMENTED_PICKER_MODIFIERS = [pickerStyle('segmented')];

const MENU_PICKER_MODIFIERS = [pickerStyle('menu')];

export interface CustomExerciseFormProps {
  /** Dismisses the sheet. Called by Cancel, and after a save that succeeded. */
  onClose: () => void;
  /**
   * Reports whether the sheet must refuse an interactive dismissal: `true`
   * while the form has unsaved input or a save is in flight.
   */
  onDismissLockChange: (isLocked: boolean) => void;
}

/**
 * The custom exercise form: a header row with Cancel, the title, and Save, above
 * a grouped `List` of fields. Host-less. It renders inside the `BottomSheet` of
 * `custom-exercise-sheet.tsx`, which mounts it once per presentation, so every
 * presentation starts from the initial state below.
 */
export const CustomExerciseForm: React.FC<CustomExerciseFormProps> = ({
  onClose,
  onDismissLockChange,
}) => {
  const categories = useExerciseStore((state) => state.categories);
  const equipment = useExerciseStore((state) => state.equipment);
  const isLoading = useExerciseStore((state) => state.isLoading);
  const createCustomExercise = useExerciseStore(
    (state) => state.createCustomExercise
  );

  const name = useNativeState('');
  const description = useNativeState('');

  // The native states hold the text. These drafts mirror it through
  // `onTextChange` so validation can run during render, where `.get()` is not
  // available. `save` reads the native states, which are never behind.
  const [nameDraft, setNameDraft] = useState('');
  const [descriptionDraft, setDescriptionDraft] = useState('');
  const [type, setType] = useState<ExerciseType>(DEFAULT_EXERCISE_TYPE);
  const [selectedCategoryRef, setSelectedCategoryRef] = useState<Ref | null>(
    null
  );
  const [equipmentRefs, setEquipmentRefs] = useState<Ref[]>([]);
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

  // Resolved on every render, so a category that stops being published while
  // the sheet is open reads as no selection instead of a blank picker.
  const categoryRef = resolveCategoryRef(selectedCategoryRef, categories);
  const draft = {
    name: nameDraft,
    description: descriptionDraft,
    type,
    categoryRef,
    equipment: equipmentRefs,
  };
  const areCategoriesUnavailable = !isLoading && categories.length === 0;
  const canSave =
    !isSaving &&
    !isLoading &&
    categories.length > 0 &&
    toCustomExerciseFields(draft) !== null;
  const isDismissLocked = isSaving || hasUnsavedInput(draft);

  useEffect(() => {
    onDismissLockChange(isDismissLocked);
  }, [isDismissLocked, onDismissLockChange]);

  const handleNameChange = useCallback((text: string) => {
    setNameDraft(text);
    setDidFail(false);
  }, []);

  const handleDescriptionChange = useCallback((text: string) => {
    setDescriptionDraft(text);
    setDidFail(false);
  }, []);

  const handleCategoryChange = useCallback(
    (selection: string) => {
      setSelectedCategoryRef(resolveCategoryRef(selection, categories));
      setDidFail(false);
    },
    [categories]
  );

  const handleEquipmentPress = useCallback(
    (ref: Ref) => {
      const next = toggleEquipmentRef(equipmentRefs, ref);
      if (next === equipmentRefs) return;
      hapticSelection();
      setEquipmentRefs(next);
      setDidFail(false);
    },
    [equipmentRefs]
  );

  const save = useCallback(async () => {
    if (isSavingRef.current) return;

    const nextName = name.get();
    const nextDescription = description.get();
    const fields = toCustomExerciseFields({
      name: nextName,
      description: nextDescription,
      type,
      categoryRef,
      equipment: equipmentRefs,
    });
    if (!fields) {
      setNameDraft(nextName);
      setDescriptionDraft(nextDescription);
      return;
    }

    isSavingRef.current = true;
    setIsSaving(true);
    setDidFail(false);
    try {
      await createCustomExercise(fields);
      if (!isMounted.current) return;
      hapticSuccess();
      onClose();
    } catch (error) {
      console.error('[CustomExercise] save', error);
      isSavingRef.current = false;
      if (!isMounted.current) return;
      setIsSaving(false);
      setDidFail(true);
    }
  }, [
    categoryRef,
    createCustomExercise,
    description,
    equipmentRefs,
    name,
    onClose,
    type,
  ]);

  return (
    <VStack spacing={0}>
      <HStack modifiers={HEADER_MODIFIERS}>
        <Button label="Cancel" onPress={onClose} />
        <Spacer />
        <Text modifiers={TITLE_MODIFIERS}>New Exercise</Text>
        <Spacer />
        <Button onPress={save} modifiers={[disabled(!canSave)]}>
          <Text modifiers={SAVE_LABEL_MODIFIERS}>Save</Text>
        </Button>
      </HStack>

      <List modifiers={LIST_MODIFIERS}>
        {/* The save error shares this footer because it is the one nearest the
            Save button, and the form has no row of its own for it. */}
        <Section
          modifiers={SECTION_MODIFIERS}
          title="Name"
          footer={
            <Text modifiers={didFail ? ERROR_TEXT_MODIFIERS : undefined}>
              {didFail ? SAVE_ERROR_MESSAGE : NAME_HELP_MESSAGE}
            </Text>
          }
        >
          <TextField
            text={name}
            placeholder="Exercise name"
            autoFocus
            maxLength={CUSTOM_EXERCISE_NAME_MAX_LENGTH}
            onTextChange={handleNameChange}
            modifiers={NAME_FIELD_MODIFIERS}
          />
        </Section>

        <Section
          modifiers={SECTION_MODIFIERS}
          title="Description"
          footer={<Text>{DESCRIPTION_HELP_MESSAGE}</Text>}
        >
          <TextField
            text={description}
            placeholder="How to perform it"
            axis="vertical"
            maxLength={CUSTOM_EXERCISE_DESCRIPTION_MAX_LENGTH}
            onTextChange={handleDescriptionChange}
            modifiers={DESCRIPTION_FIELD_MODIFIERS}
          />
        </Section>

        {/* Neither picker takes the `key` revision that the Settings pickers
            use. Those remount to undo a native selection whose write failed.
            Here the selection is local state that always follows the native
            change. Both need `label`: `PickerView.swift` at @expo/ui 57.0.7
            builds no `Picker` at all without one, even though the segmented
            style never draws it. */}
        <Section title="Type" modifiers={SECTION_MODIFIERS}>
          <Picker
            label="Type"
            selection={type}
            onSelectionChange={setType}
            modifiers={SEGMENTED_PICKER_MODIFIERS}
          >
            {EXERCISE_TYPE_OPTIONS.map((option) => (
              <Text key={option.value} modifiers={[tag(option.value)]}>
                {option.label}
              </Text>
            ))}
          </Picker>
        </Section>

        <Section
          modifiers={SECTION_MODIFIERS}
          footer={
            <Text
              modifiers={
                areCategoriesUnavailable ? ERROR_TEXT_MODIFIERS : undefined
              }
            >
              {areCategoriesUnavailable
                ? CATEGORY_UNAVAILABLE_MESSAGE
                : CATEGORY_HELP_MESSAGE}
            </Text>
          }
        >
          <Picker
            label="Category"
            selection={categoryRef ?? NO_CATEGORY_TAG}
            onSelectionChange={handleCategoryChange}
            modifiers={MENU_PICKER_MODIFIERS}
          >
            <Text modifiers={[tag(NO_CATEGORY_TAG)]}>None</Text>
            {categories.map((category) => (
              <Text key={category.ref} modifiers={[tag(category.ref)]}>
                {category.name}
              </Text>
            ))}
          </Picker>
        </Section>

        {equipment.length > 0 ? (
          <Section
            modifiers={SECTION_MODIFIERS}
            title="Equipment"
            footer={<Text>{EQUIPMENT_HELP_MESSAGE}</Text>}
          >
            {equipment.map((item) => (
              <CustomExerciseEquipmentRow
                key={item.ref}
                name={item.name}
                isSelected={equipmentRefs.includes(item.ref)}
                onPress={() => handleEquipmentPress(item.ref)}
              />
            ))}
          </Section>
        ) : null}
      </List>
    </VStack>
  );
};
