import type { UserProfile } from '@/database';
import type React from 'react';
import { useCallback, useState } from 'react';
import { Host } from '@expo/ui';
import {
  Button,
  HStack,
  LabeledContent,
  List,
  Section,
  Spacer,
  Text,
  TextField,
  useNativeState,
} from '@expo/ui/swift-ui';
import {
  accessibilityHint,
  accessibilityLabel,
  autocorrectionDisabled,
  disabled,
  font,
  foregroundStyle,
  keyboardType,
  lineLimit,
  textContentType,
  textInputAutocapitalization,
} from '@expo/ui/swift-ui/modifiers';
import { useRouter } from 'expo-router';

import { useUserStore } from '@/features/user/store/use-user-store';
import { useAppColorScheme } from '@/hooks/use-app-color-scheme';
import {
  centimetersToInches,
  inchesToCentimeters,
  kilogramsToPounds,
  poundsToKilograms,
  toLocalDateId,
} from '@/lib/format';
import { hapticSuccess } from '@/lib/haptics';
import { colors } from '@/theme/colors';
import { mods } from '@/theme/modifiers';
import { layout } from '@/theme/styles';

const EMPTY_NAME_MESSAGE = 'Enter a name to save.';
const NAME_HELP_MESSAGE = 'This is the name shown across the app.';
const BIRTH_DATE_HELP_MESSAGE = 'Optional. Use YYYY-MM-DD.';
const PURPOSE_HELP_MESSAGE = 'Optional. What are you training for?';
const WEIGHT_HELP_MESSAGE =
  'Optional. A new value adds a weigh-in recorded for today.';
const SAVE_ERROR_MESSAGE =
  "Couldn't save your profile. Check your connection and try again.";

const NAME_FIELD_MODIFIERS = [
  autocorrectionDisabled(true),
  textInputAutocapitalization('words'),
  textContentType('name'),
];

const BIRTH_DATE_FIELD_MODIFIERS = [
  autocorrectionDisabled(true),
  keyboardType('numbers-and-punctuation'),
  textContentType('birthdate'),
  accessibilityLabel('Birth date'),
  accessibilityHint('Enter a date in year, month, day format.'),
];

const NUMBER_FIELD_MODIFIERS = [
  autocorrectionDisabled(true),
  keyboardType('decimal-pad'),
];

const PURPOSE_FIELD_MODIFIERS = [
  textInputAutocapitalization('sentences'),
  lineLimit(3),
];

const HELP_TEXT_MODIFIERS = [
  font({ textStyle: 'footnote' }),
  foregroundStyle(colors.secondaryLabel),
];

const ERROR_TEXT_MODIFIERS = [
  font({ textStyle: 'footnote' }),
  foregroundStyle(colors.systemRed),
];

interface Drafts {
  name: string | null;
  birthDate: string | null;
  height: string | null;
  purpose: string | null;
  weight: string | null;
}

const isValidBirthDate = (value: string): boolean => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));

  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day &&
    value <= toLocalDateId(new Date())
  );
};

const parseOptionalNumber = (value: string): number | null =>
  value.length > 0 ? Number(value.replace(',', '.')) : null;

const formatInputNumber = (value: number): string =>
  String(Number(value.toFixed(2)));

interface LoadedEditProfileFormProps {
  profile: UserProfile;
  colorScheme: 'light' | 'dark' | undefined;
}

const LoadedEditProfileForm: React.FC<LoadedEditProfileFormProps> = ({
  profile,
  colorScheme,
}) => {
  const router = useRouter();
  const currentWeight = useUserStore((state) => state.currentWeight);
  const updateProfile = useUserStore((state) => state.updateProfile);
  const addWeighIn = useUserStore((state) => state.addWeighIn);
  const [initialProfile] = useState(profile);
  const units = initialProfile.settings.units;
  const isImperial = units === 'imperial';

  const storedName = initialProfile.displayName;
  const storedBirthDate = initialProfile.body.birthDate ?? '';
  const storedHeightCm = initialProfile.body.heightCm;
  const storedHeight =
    storedHeightCm === null
      ? ''
      : formatInputNumber(
          isImperial ? centimetersToInches(storedHeightCm) : storedHeightCm
        );
  const storedPurpose = initialProfile.purpose ?? '';

  const name = useNativeState(storedName);
  const birthDate = useNativeState(storedBirthDate);
  const height = useNativeState(storedHeight);
  const purpose = useNativeState(storedPurpose);
  const weight = useNativeState('');

  const [drafts, setDrafts] = useState<Drafts>({
    name: null,
    birthDate: null,
    height: null,
    purpose: null,
    weight: null,
  });
  const [didFail, setDidFail] = useState(false);

  const updateDraft = useCallback((key: keyof Drafts, value: string) => {
    setDrafts((current) => ({ ...current, [key]: value }));
    setDidFail(false);
  }, []);

  const currentName = (drafts.name ?? storedName).trim();
  const currentBirthDate = (drafts.birthDate ?? storedBirthDate).trim();
  const currentHeight = (drafts.height ?? storedHeight).trim();
  const currentWeightDraft = (drafts.weight ?? '').trim();

  const nameError = currentName.length === 0 ? EMPTY_NAME_MESSAGE : null;
  const birthDateError =
    currentBirthDate.length > 0 && !isValidBirthDate(currentBirthDate)
      ? 'Enter a real date, not in the future, as YYYY-MM-DD.'
      : null;
  const parsedHeight = parseOptionalNumber(currentHeight);
  const parsedHeightCm =
    drafts.height === null
      ? storedHeightCm
      : parsedHeight === null
        ? null
        : isImperial
          ? inchesToCentimeters(parsedHeight)
          : parsedHeight;
  const heightUnit = isImperial ? 'in' : 'cm';
  const heightUnitName = isImperial ? 'inches' : 'centimeters';
  const heightLimit = isImperial
    ? formatInputNumber(centimetersToInches(300))
    : '300';
  const heightError =
    parsedHeightCm !== null &&
    (!Number.isFinite(parsedHeightCm) ||
      parsedHeightCm <= 0 ||
      parsedHeightCm > 300)
      ? `Enter a height greater than 0 and no more than ${heightLimit} ${heightUnit}.`
      : null;
  const parsedWeight = parseOptionalNumber(currentWeightDraft);
  const parsedWeightKg =
    parsedWeight === null
      ? null
      : isImperial
        ? poundsToKilograms(parsedWeight)
        : parsedWeight;
  const weightUnit = isImperial ? 'lb' : 'kg';
  const weightLimit = isImperial
    ? formatInputNumber(kilogramsToPounds(500))
    : '500';
  const weightError =
    parsedWeightKg !== null &&
    (!Number.isFinite(parsedWeightKg) ||
      parsedWeightKg <= 0 ||
      parsedWeightKg >= 500)
      ? `Enter a weight greater than 0 and less than ${weightLimit} ${weightUnit}.`
      : null;
  const isInvalid =
    nameError !== null ||
    birthDateError !== null ||
    heightError !== null ||
    weightError !== null;
  const currentWeightLabel =
    currentWeight === null
      ? 'No weigh-in yet'
      : `${formatInputNumber(
          isImperial ? kilogramsToPounds(currentWeight) : currentWeight
        )} ${weightUnit}`;

  const save = useCallback(async () => {
    const nextName = name.get().trim();
    const nextBirthDate = birthDate.get().trim();
    const nextHeight = height.get().trim();
    const nextPurpose = purpose.get().trim();
    const nextWeight = weight.get().trim();
    const nextHeightValue = parseOptionalNumber(nextHeight);
    const nextWeightValue = parseOptionalNumber(nextWeight);
    const heightChanged = drafts.height !== null || nextHeight !== storedHeight;
    const nextHeightCm = heightChanged
      ? nextHeightValue === null
        ? null
        : isImperial
          ? inchesToCentimeters(nextHeightValue)
          : nextHeightValue
      : storedHeightCm;
    const nextWeightKg =
      nextWeightValue === null
        ? null
        : isImperial
          ? poundsToKilograms(nextWeightValue)
          : nextWeightValue;

    const invalid =
      nextName.length === 0 ||
      (nextBirthDate.length > 0 && !isValidBirthDate(nextBirthDate)) ||
      (nextHeightCm !== null &&
        (!Number.isFinite(nextHeightCm) ||
          nextHeightCm <= 0 ||
          nextHeightCm > 300)) ||
      (nextWeightKg !== null &&
        (!Number.isFinite(nextWeightKg) ||
          nextWeightKg <= 0 ||
          nextWeightKg >= 500));

    if (invalid) {
      setDrafts({
        name: nextName,
        birthDate: nextBirthDate,
        height: heightChanged ? nextHeight : null,
        purpose: nextPurpose,
        weight: nextWeight,
      });
      return;
    }

    try {
      await updateProfile({
        displayName: nextName,
        birthDate: nextBirthDate || null,
        heightCm: nextHeightCm,
        purpose: nextPurpose || null,
      });
      if (nextWeightKg !== null) {
        await addWeighIn({ recordedAt: new Date(), weightKg: nextWeightKg });
      }
      hapticSuccess();
      router.back();
    } catch (error) {
      console.error('[EditProfile] save', error);
      setDidFail(true);
    }
  }, [
    addWeighIn,
    birthDate,
    drafts.height,
    height,
    isImperial,
    name,
    purpose,
    router,
    storedHeight,
    storedHeightCm,
    updateProfile,
    weight,
  ]);

  return (
    <Host style={layout.groupedScreen} colorScheme={colorScheme}>
      <List modifiers={mods.listInsetGrouped}>
        <Section
          title="Name"
          footer={
            <Text
              modifiers={nameError ? ERROR_TEXT_MODIFIERS : HELP_TEXT_MODIFIERS}
            >
              {nameError ?? NAME_HELP_MESSAGE}
            </Text>
          }
        >
          <TextField
            text={name}
            placeholder="Your name"
            autoFocus
            maxLength={100}
            onTextChange={(text) => updateDraft('name', text)}
            modifiers={NAME_FIELD_MODIFIERS}
          />
        </Section>

        <Section
          title="Birth Date"
          footer={
            <Text
              modifiers={
                birthDateError ? ERROR_TEXT_MODIFIERS : HELP_TEXT_MODIFIERS
              }
            >
              {birthDateError ?? BIRTH_DATE_HELP_MESSAGE}
            </Text>
          }
        >
          <TextField
            text={birthDate}
            placeholder="YYYY-MM-DD"
            maxLength={10}
            onTextChange={(text) => updateDraft('birthDate', text)}
            modifiers={BIRTH_DATE_FIELD_MODIFIERS}
          />
        </Section>

        <Section
          title="Height"
          footer={
            <Text
              modifiers={
                heightError ? ERROR_TEXT_MODIFIERS : HELP_TEXT_MODIFIERS
              }
            >
              {heightError ?? `Optional. Enter height in ${heightUnitName}.`}
            </Text>
          }
        >
          <TextField
            text={height}
            placeholder={`Height (${heightUnit})`}
            maxLength={6}
            onTextChange={(text) => updateDraft('height', text)}
            modifiers={NUMBER_FIELD_MODIFIERS}
          />
        </Section>

        <Section title="Purpose" footer={<Text>{PURPOSE_HELP_MESSAGE}</Text>}>
          <TextField
            text={purpose}
            placeholder="Build strength, prepare for a race..."
            axis="vertical"
            maxLength={2000}
            onTextChange={(text) => updateDraft('purpose', text)}
            modifiers={PURPOSE_FIELD_MODIFIERS}
          />
        </Section>

        <Section
          title="Weight"
          footer={
            <Text
              modifiers={
                weightError ? ERROR_TEXT_MODIFIERS : HELP_TEXT_MODIFIERS
              }
            >
              {weightError ?? WEIGHT_HELP_MESSAGE}
            </Text>
          }
        >
          <LabeledContent label="Current">
            <Text>{currentWeightLabel}</Text>
          </LabeledContent>
          <TextField
            text={weight}
            placeholder={`New weight (${weightUnit})`}
            maxLength={7}
            onTextChange={(text) => updateDraft('weight', text)}
            modifiers={NUMBER_FIELD_MODIFIERS}
          />
        </Section>

        <Section
          footer={
            didFail ? (
              <Text modifiers={ERROR_TEXT_MODIFIERS}>{SAVE_ERROR_MESSAGE}</Text>
            ) : undefined
          }
        >
          <Button onPress={save} modifiers={[disabled(isInvalid)]}>
            <HStack>
              <Spacer />
              <Text
                modifiers={[font({ textStyle: 'body', weight: 'semibold' })]}
              >
                Save
              </Text>
              <Spacer />
            </HStack>
          </Button>
        </Section>
      </List>
    </Host>
  );
};

/** Existing Edit Profile sheet, extended with body details and weigh-ins. */
export const EditProfileForm: React.FC = () => {
  const colorScheme = useAppColorScheme();
  const profile = useUserStore((state) => state.profile);

  if (!profile) {
    return (
      <Host style={layout.groupedScreen} colorScheme={colorScheme}>
        <List modifiers={mods.listInsetGroupedRedacted}>
          <Section title="Profile">
            <Text>Loading profile</Text>
          </Section>
        </List>
      </Host>
    );
  }

  return (
    <LoadedEditProfileForm
      key={profile.settings.units}
      profile={profile}
      colorScheme={colorScheme}
    />
  );
};
