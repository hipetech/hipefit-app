import type {
  BodyMeasurement,
  CustomExercise,
  CustomExerciseCategory,
  Equipment,
  Exercise,
  ExerciseCategory,
  ExerciseType,
  GlobalLocalizedText,
  Locale,
  Ref,
  TemplateExercise,
  TemplateSet,
  UserLocalizedText,
  UserProfile,
  UserSettings,
  Workout,
  WorkoutExercise,
  WorkoutSet,
  WorkoutStatus,
  WorkoutTemplate,
} from './types';
import { Timestamp } from '@react-native-firebase/firestore';

const locales = ['en', 'uk'] as const;
const exerciseTypes = ['strength', 'cardio', 'bodyweight'] as const;
const workoutStatuses = ['in_progress', 'completed', 'abandoned'] as const;
const themes = ['light', 'dark', 'system'] as const;
const units = ['metric', 'imperial'] as const;

const globalRefPattern = /^global:[a-z0-9-]+$/;
const customRefPattern = /^custom:[A-Za-z0-9_-]{1,64}$/;
const calendarDatePattern = /^(\d{4})-(\d{2})-(\d{2})$/;

const NAME_MAX_LENGTH = 100;
const LONG_TEXT_MAX_LENGTH = 2000;
const URL_MAX_LENGTH = 2048;
const HIDDEN_REFS_MAX_LENGTH = 500;
const EXERCISES_MAX_LENGTH = 50;
const MAX_BODYWEIGHT_KG = 500;

export class DatabaseValidationError extends Error {
  constructor(path: string, message: string) {
    super(`${path}: ${message}`);
    this.name = 'DatabaseValidationError';
  }
}

type RecordValue = Record<string, unknown>;

function fail(path: string, message: string): never {
  throw new DatabaseValidationError(path, message);
}

function assertRecord(
  value: unknown,
  path: string
): asserts value is RecordValue {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    fail(path, 'expected a map');
  }

  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) {
    fail(path, 'expected a plain map');
  }
}

function assertKeys(
  value: unknown,
  required: readonly string[],
  optional: readonly string[],
  path: string
): asserts value is RecordValue {
  assertRecord(value, path);

  const allowed = new Set([...required, ...optional]);
  for (const key of Reflect.ownKeys(value)) {
    if (typeof key !== 'string' || !allowed.has(key)) {
      fail(path, `unexpected field ${String(key)}`);
    }
    if (value[key] === undefined) {
      fail(`${path}.${key}`, 'must be omitted rather than undefined');
    }
  }

  for (const key of required) {
    if (!Object.prototype.hasOwnProperty.call(value, key)) {
      fail(`${path}.${key}`, 'field is required');
    }
  }
}

function assertArray(
  value: unknown,
  path: string,
  maxLength?: number
): asserts value is unknown[] {
  if (!Array.isArray(value)) {
    fail(path, 'expected an array');
  }
  if (maxLength !== undefined && value.length > maxLength) {
    fail(path, `must contain at most ${maxLength} entries`);
  }
  for (let index = 0; index < value.length; index += 1) {
    if (!Object.prototype.hasOwnProperty.call(value, index)) {
      fail(`${path}[${index}]`, 'array entries must not be sparse');
    }
  }
}

function assertString(
  value: unknown,
  path: string,
  options: { maxLength: number; nonEmpty?: boolean }
): asserts value is string {
  if (typeof value !== 'string') {
    fail(path, 'expected a string');
  }
  if (options.nonEmpty && value.trim().length === 0) {
    fail(path, 'must not be empty');
  }
  if (value.length > options.maxLength) {
    fail(path, `must be at most ${options.maxLength} characters`);
  }
}

function assertNullableString(
  value: unknown,
  path: string,
  maxLength: number
): asserts value is string | null {
  if (value !== null) {
    assertString(value, path, { maxLength });
  }
}

function assertBoolean(value: unknown, path: string): asserts value is boolean {
  if (typeof value !== 'boolean') {
    fail(path, 'expected a boolean');
  }
}

function assertNumber(
  value: unknown,
  path: string,
  options: {
    min?: number;
    max?: number;
    maxExclusive?: number;
    integer?: boolean;
  } = {}
): asserts value is number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    fail(path, 'expected a finite number');
  }
  if (options.integer && !Number.isInteger(value)) {
    fail(path, 'expected an integer');
  }
  if (options.min !== undefined && value < options.min) {
    fail(path, `must be at least ${options.min}`);
  }
  if (options.max !== undefined && value > options.max) {
    fail(path, `must be at most ${options.max}`);
  }
  if (options.maxExclusive !== undefined && value >= options.maxExclusive) {
    fail(path, `must be less than ${options.maxExclusive}`);
  }
}

function assertNullableNumber(
  value: unknown,
  path: string,
  options: Parameters<typeof assertNumber>[2] = {}
): asserts value is number | null {
  if (value !== null) {
    assertNumber(value, path, options);
  }
}

function assertEnum<T extends string>(
  value: unknown,
  values: readonly T[],
  path: string
): asserts value is T {
  if (typeof value !== 'string' || !values.includes(value as T)) {
    fail(path, `expected one of ${values.join(', ')}`);
  }
}

function assertTimestamp(
  value: unknown,
  path: string
): asserts value is Timestamp {
  if (!(value instanceof Timestamp)) {
    console.error('[Database timestamp diagnostic]', {
      path,
      type: Object.prototype.toString.call(value),
      constructor:
        typeof value === 'object' && value !== null
          ? value.constructor?.name
          : null,
      keys:
        typeof value === 'object' && value !== null ? Object.keys(value) : [],
      value,
    });
    fail(path, 'expected a Firestore Timestamp');
  }
}

const compareTimestamps = (left: Timestamp, right: Timestamp): number => {
  if (left.seconds !== right.seconds) {
    return left.seconds - right.seconds;
  }
  return left.nanoseconds - right.nanoseconds;
};

function assertTimestampOrder(
  earlier: Timestamp,
  later: Timestamp,
  path: string
): void {
  if (compareTimestamps(earlier, later) > 0) {
    fail(path, 'must not be earlier than its related timestamp');
  }
}

function assertLocale(value: unknown, path: string): asserts value is Locale {
  assertEnum(value, locales, path);
}

function assertExerciseType(
  value: unknown,
  path: string
): asserts value is ExerciseType {
  assertEnum(value, exerciseTypes, path);
}

function assertWorkoutStatus(
  value: unknown,
  path: string
): asserts value is WorkoutStatus {
  assertEnum(value, workoutStatuses, path);
}

function assertCalendarDate(
  value: unknown,
  path: string
): asserts value is string {
  assertString(value, path, { maxLength: 10 });
  const match = calendarDatePattern.exec(value);
  if (!match) {
    fail(path, 'expected YYYY-MM-DD');
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const leapYear = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const daysInMonth = [
    31,
    leapYear ? 29 : 28,
    31,
    30,
    31,
    30,
    31,
    31,
    30,
    31,
    30,
    31,
  ];

  if (month < 1 || month > 12 || day < 1 || day > daysInMonth[month - 1]!) {
    fail(path, 'expected a valid calendar date');
  }
}

function assertTimeZone(value: unknown, path: string): asserts value is string {
  assertString(value, path, { maxLength: NAME_MAX_LENGTH, nonEmpty: true });
  try {
    new Intl.DateTimeFormat('en', { timeZone: value }).format();
  } catch {
    fail(path, 'expected an IANA time zone');
  }
}

function assertRefValue(value: unknown, path: string): asserts value is Ref {
  if (
    typeof value !== 'string' ||
    (!globalRefPattern.test(value) && !customRefPattern.test(value))
  ) {
    fail(path, 'expected global:<slug> or custom:<Firestore ID>');
  }
}

function assertGlobalRef(value: unknown, path: string): asserts value is Ref {
  assertRefValue(value, path);
  if (!value.startsWith('global:')) {
    fail(path, 'expected a global reference');
  }
}

function assertCustomRef(value: unknown, path: string): asserts value is Ref {
  assertRefValue(value, path);
  if (!value.startsWith('custom:')) {
    fail(path, 'expected a custom reference');
  }
}

function assertRefArray(
  value: unknown,
  path: string,
  maxLength?: number
): asserts value is Ref[] {
  assertArray(value, path, maxLength);
  value.forEach((entry, index) => assertRefValue(entry, `${path}[${index}]`));
}

function assertGlobalLocalizedText(
  value: unknown,
  path: string,
  options: { maxLength: number; nonEmpty?: boolean }
): asserts value is GlobalLocalizedText {
  assertKeys(value, ['en'], ['uk'], path);
  assertString(value.en, `${path}.en`, options);
  if (value.uk !== undefined) {
    assertString(value.uk, `${path}.uk`, options);
  }
}

function assertUserLocalizedText(
  value: unknown,
  defaultLocale: Locale,
  path: string,
  options: { maxLength: number; nonEmpty?: boolean }
): asserts value is UserLocalizedText {
  assertKeys(value, [], locales, path);
  const presentLocales = locales.filter(
    (locale) => value[locale] !== undefined
  );
  if (presentLocales.length === 0) {
    fail(path, 'must contain at least one translation');
  }
  for (const locale of presentLocales) {
    assertString(value[locale], `${path}.${locale}`, options);
  }
  if (value[defaultLocale] === undefined) {
    fail(path, `must contain the default locale ${defaultLocale}`);
  }
}

function assertUserSettings(
  value: unknown,
  path: string
): asserts value is UserSettings {
  assertKeys(
    value,
    ['theme', 'language', 'units', 'hiddenExerciseRefs', 'hiddenCategoryRefs'],
    [],
    path
  );
  assertEnum(value.theme, themes, `${path}.theme`);
  assertLocale(value.language, `${path}.language`);
  assertEnum(value.units, units, `${path}.units`);
  assertRefArray(
    value.hiddenExerciseRefs,
    `${path}.hiddenExerciseRefs`,
    HIDDEN_REFS_MAX_LENGTH
  );
  assertRefArray(
    value.hiddenCategoryRefs,
    `${path}.hiddenCategoryRefs`,
    HIDDEN_REFS_MAX_LENGTH
  );
}

const validateUserProfile = (value: unknown): UserProfile => {
  const path = 'user';
  assertKeys(
    value,
    [
      'firstName',
      'lastName',
      'displayName',
      'email',
      'photoURL',
      'body',
      'purpose',
      'settings',
      'schemaVersion',
      'createdAt',
      'updatedAt',
    ],
    [],
    path
  );
  assertString(value.firstName, `${path}.firstName`, {
    maxLength: NAME_MAX_LENGTH,
  });
  assertString(value.lastName, `${path}.lastName`, {
    maxLength: NAME_MAX_LENGTH,
  });
  assertString(value.displayName, `${path}.displayName`, {
    maxLength: NAME_MAX_LENGTH,
  });
  assertNullableString(value.email, `${path}.email`, 320);
  assertNullableString(value.photoURL, `${path}.photoURL`, URL_MAX_LENGTH);
  assertKeys(value.body, ['birthDate', 'heightCm'], [], `${path}.body`);
  if (value.body.birthDate !== null) {
    assertCalendarDate(value.body.birthDate, `${path}.body.birthDate`);
  }
  assertNullableNumber(value.body.heightCm, `${path}.body.heightCm`, {
    min: 0,
    max: 300,
  });
  assertNullableString(value.purpose, `${path}.purpose`, LONG_TEXT_MAX_LENGTH);
  assertUserSettings(value.settings, `${path}.settings`);
  assertNumber(value.schemaVersion, `${path}.schemaVersion`, {
    min: 0,
    integer: true,
  });
  assertTimestamp(value.createdAt, `${path}.createdAt`);
  assertTimestamp(value.updatedAt, `${path}.updatedAt`);
  assertTimestampOrder(value.createdAt, value.updatedAt, `${path}.updatedAt`);
  return value as unknown as UserProfile;
};

const validateExerciseCategory = (value: unknown): ExerciseCategory => {
  const path = 'exerciseCategory';
  assertKeys(value, ['name', 'order', 'icon', 'isRetired'], [], path);
  assertGlobalLocalizedText(value.name, `${path}.name`, {
    maxLength: NAME_MAX_LENGTH,
    nonEmpty: true,
  });
  assertNumber(value.order, `${path}.order`, { min: 0, integer: true });
  assertString(value.icon, `${path}.icon`, {
    maxLength: NAME_MAX_LENGTH,
    nonEmpty: true,
  });
  assertBoolean(value.isRetired, `${path}.isRetired`);
  return value as unknown as ExerciseCategory;
};

const validateEquipment = (value: unknown): Equipment => {
  const path = 'equipment';
  assertKeys(value, ['name', 'icon', 'isRetired'], [], path);
  assertGlobalLocalizedText(value.name, `${path}.name`, {
    maxLength: NAME_MAX_LENGTH,
    nonEmpty: true,
  });
  assertNullableString(value.icon, `${path}.icon`, NAME_MAX_LENGTH);
  assertBoolean(value.isRetired, `${path}.isRetired`);
  return value as unknown as Equipment;
};

const validateExercise = (value: unknown): Exercise => {
  const path = 'exercise';
  assertKeys(
    value,
    [
      'categoryRef',
      'name',
      'description',
      'type',
      'equipment',
      'imageURL',
      'isRetired',
    ],
    [],
    path
  );
  assertGlobalRef(value.categoryRef, `${path}.categoryRef`);
  assertGlobalLocalizedText(value.name, `${path}.name`, {
    maxLength: NAME_MAX_LENGTH,
    nonEmpty: true,
  });
  assertGlobalLocalizedText(value.description, `${path}.description`, {
    maxLength: LONG_TEXT_MAX_LENGTH,
  });
  assertExerciseType(value.type, `${path}.type`);
  assertRefArray(value.equipment, `${path}.equipment`);
  value.equipment.forEach((ref, index) =>
    assertGlobalRef(ref, `${path}.equipment[${index}]`)
  );
  assertNullableString(value.imageURL, `${path}.imageURL`, URL_MAX_LENGTH);
  assertBoolean(value.isRetired, `${path}.isRetired`);
  return value as unknown as Exercise;
};

const validateCustomExerciseCategory = (
  value: unknown
): CustomExerciseCategory => {
  const path = 'customExerciseCategory';
  assertKeys(
    value,
    [
      'name',
      'defaultLocale',
      'order',
      'icon',
      'isArchived',
      'createdAt',
      'updatedAt',
    ],
    [],
    path
  );
  assertLocale(value.defaultLocale, `${path}.defaultLocale`);
  assertUserLocalizedText(value.name, value.defaultLocale, `${path}.name`, {
    maxLength: NAME_MAX_LENGTH,
    nonEmpty: true,
  });
  assertNumber(value.order, `${path}.order`, { min: 0, integer: true });
  assertNullableString(value.icon, `${path}.icon`, NAME_MAX_LENGTH);
  assertBoolean(value.isArchived, `${path}.isArchived`);
  assertTimestamp(value.createdAt, `${path}.createdAt`);
  assertTimestamp(value.updatedAt, `${path}.updatedAt`);
  assertTimestampOrder(value.createdAt, value.updatedAt, `${path}.updatedAt`);
  return value as unknown as CustomExerciseCategory;
};

const validateCustomExercise = (value: unknown): CustomExercise => {
  const path = 'customExercise';
  assertKeys(
    value,
    [
      'categoryRef',
      'forkedFromRef',
      'name',
      'description',
      'defaultLocale',
      'type',
      'equipment',
      'imageURL',
      'createdAt',
      'updatedAt',
    ],
    [],
    path
  );
  assertRefValue(value.categoryRef, `${path}.categoryRef`);
  if (value.forkedFromRef !== null) {
    assertGlobalRef(value.forkedFromRef, `${path}.forkedFromRef`);
  }
  assertLocale(value.defaultLocale, `${path}.defaultLocale`);
  assertUserLocalizedText(value.name, value.defaultLocale, `${path}.name`, {
    maxLength: NAME_MAX_LENGTH,
    nonEmpty: true,
  });
  assertUserLocalizedText(
    value.description,
    value.defaultLocale,
    `${path}.description`,
    { maxLength: LONG_TEXT_MAX_LENGTH }
  );
  assertExerciseType(value.type, `${path}.type`);
  assertRefArray(value.equipment, `${path}.equipment`);
  value.equipment.forEach((ref, index) =>
    assertGlobalRef(ref, `${path}.equipment[${index}]`)
  );
  assertNullableString(value.imageURL, `${path}.imageURL`, URL_MAX_LENGTH);
  assertTimestamp(value.createdAt, `${path}.createdAt`);
  assertTimestamp(value.updatedAt, `${path}.updatedAt`);
  assertTimestampOrder(value.createdAt, value.updatedAt, `${path}.updatedAt`);
  return value as unknown as CustomExercise;
};

function assertTemplateSet(
  value: unknown,
  path: string
): asserts value is TemplateSet {
  assertKeys(value, [], ['weight', 'reps', 'duration', 'distance'], path);
  if (value.weight !== undefined) {
    assertNumber(value.weight, `${path}.weight`, { min: 0 });
  }
  if (value.reps !== undefined) {
    assertNumber(value.reps, `${path}.reps`, { min: 0, integer: true });
  }
  if (value.duration !== undefined) {
    assertNumber(value.duration, `${path}.duration`, { min: 0 });
  }
  if (value.distance !== undefined) {
    assertNumber(value.distance, `${path}.distance`, { min: 0 });
  }
}

function assertTemplateExercise(
  value: unknown,
  path: string
): asserts value is TemplateExercise {
  assertKeys(value, ['exerciseRef', 'nameSnapshot', 'type', 'sets'], [], path);
  assertRefValue(value.exerciseRef, `${path}.exerciseRef`);
  assertString(value.nameSnapshot, `${path}.nameSnapshot`, {
    maxLength: NAME_MAX_LENGTH,
    nonEmpty: true,
  });
  assertExerciseType(value.type, `${path}.type`);
  assertArray(value.sets, `${path}.sets`);
  value.sets.forEach((set, index) =>
    assertTemplateSet(set, `${path}.sets[${index}]`)
  );
}

const validateWorkoutTemplate = (value: unknown): WorkoutTemplate => {
  const path = 'workoutTemplate';
  assertKeys(
    value,
    [
      'name',
      'description',
      'exercises',
      'estimatedDuration',
      'isArchived',
      'lastPerformedAt',
      'timesPerformed',
      'createdAt',
      'updatedAt',
    ],
    [],
    path
  );
  assertString(value.name, `${path}.name`, {
    maxLength: NAME_MAX_LENGTH,
    nonEmpty: true,
  });
  assertNullableString(
    value.description,
    `${path}.description`,
    LONG_TEXT_MAX_LENGTH
  );
  assertArray(value.exercises, `${path}.exercises`, EXERCISES_MAX_LENGTH);
  value.exercises.forEach((exercise, index) =>
    assertTemplateExercise(exercise, `${path}.exercises[${index}]`)
  );
  assertNullableNumber(value.estimatedDuration, `${path}.estimatedDuration`, {
    min: 0,
  });
  assertBoolean(value.isArchived, `${path}.isArchived`);
  if (value.lastPerformedAt !== null) {
    assertTimestamp(value.lastPerformedAt, `${path}.lastPerformedAt`);
  }
  assertNumber(value.timesPerformed, `${path}.timesPerformed`, {
    min: 0,
    integer: true,
  });
  assertTimestamp(value.createdAt, `${path}.createdAt`);
  assertTimestamp(value.updatedAt, `${path}.updatedAt`);
  assertTimestampOrder(value.createdAt, value.updatedAt, `${path}.updatedAt`);
  return value as unknown as WorkoutTemplate;
};

function assertWorkoutSet(
  value: unknown,
  path: string
): asserts value is WorkoutSet {
  assertKeys(
    value,
    ['isCompleted'],
    ['weight', 'reps', 'duration', 'distance', 'rpe', 'notes'],
    path
  );
  assertBoolean(value.isCompleted, `${path}.isCompleted`);
  if (value.weight !== undefined) {
    assertNumber(value.weight, `${path}.weight`, { min: 0 });
  }
  if (value.reps !== undefined) {
    assertNumber(value.reps, `${path}.reps`, { min: 0, integer: true });
  }
  if (value.duration !== undefined) {
    assertNumber(value.duration, `${path}.duration`, { min: 0 });
  }
  if (value.distance !== undefined) {
    assertNumber(value.distance, `${path}.distance`, { min: 0 });
  }
  if (value.rpe !== undefined) {
    assertNumber(value.rpe, `${path}.rpe`, { min: 1, max: 10 });
  }
  if (value.notes !== undefined) {
    assertString(value.notes, `${path}.notes`, {
      maxLength: LONG_TEXT_MAX_LENGTH,
    });
  }
}

function assertWorkoutExercise(
  value: unknown,
  path: string
): asserts value is WorkoutExercise {
  assertKeys(value, ['exerciseRef', 'nameSnapshot', 'type', 'sets'], [], path);
  assertRefValue(value.exerciseRef, `${path}.exerciseRef`);
  assertString(value.nameSnapshot, `${path}.nameSnapshot`, {
    maxLength: NAME_MAX_LENGTH,
    nonEmpty: true,
  });
  assertExerciseType(value.type, `${path}.type`);
  assertArray(value.sets, `${path}.sets`);
  value.sets.forEach((set, index) =>
    assertWorkoutSet(set, `${path}.sets[${index}]`)
  );
}

const validateWorkout = (value: unknown): Workout => {
  const path = 'workout';
  assertKeys(
    value,
    [
      'templateRef',
      'templateName',
      'status',
      'startedAt',
      'completedAt',
      'activeSeconds',
      'localDate',
      'timeZone',
      'bodyweightKg',
      'notes',
      'exercises',
      'createdAt',
      'updatedAt',
    ],
    [],
    path
  );
  if (value.templateRef !== null) {
    assertCustomRef(value.templateRef, `${path}.templateRef`);
  }
  assertNullableString(
    value.templateName,
    `${path}.templateName`,
    NAME_MAX_LENGTH
  );
  assertWorkoutStatus(value.status, `${path}.status`);
  assertTimestamp(value.startedAt, `${path}.startedAt`);
  if (value.completedAt !== null) {
    assertTimestamp(value.completedAt, `${path}.completedAt`);
    assertTimestampOrder(
      value.startedAt,
      value.completedAt,
      `${path}.completedAt`
    );
  }
  if (value.status === 'completed' && value.completedAt === null) {
    fail(`${path}.completedAt`, 'is required for a completed workout');
  }
  assertNullableNumber(value.activeSeconds, `${path}.activeSeconds`, {
    min: 0,
  });
  assertCalendarDate(value.localDate, `${path}.localDate`);
  assertTimeZone(value.timeZone, `${path}.timeZone`);
  assertNullableNumber(value.bodyweightKg, `${path}.bodyweightKg`, {
    min: Number.MIN_VALUE,
    maxExclusive: MAX_BODYWEIGHT_KG,
  });
  assertNullableString(value.notes, `${path}.notes`, LONG_TEXT_MAX_LENGTH);
  assertArray(value.exercises, `${path}.exercises`, EXERCISES_MAX_LENGTH);
  value.exercises.forEach((exercise, index) =>
    assertWorkoutExercise(exercise, `${path}.exercises[${index}]`)
  );
  assertTimestamp(value.createdAt, `${path}.createdAt`);
  assertTimestamp(value.updatedAt, `${path}.updatedAt`);
  assertTimestampOrder(value.createdAt, value.updatedAt, `${path}.updatedAt`);
  return value as unknown as Workout;
};

const validateBodyMeasurement = (value: unknown): BodyMeasurement => {
  const path = 'bodyMeasurement';
  assertKeys(value, ['recordedAt', 'weightKg'], ['note'], path);
  assertTimestamp(value.recordedAt, `${path}.recordedAt`);
  assertNumber(value.weightKg, `${path}.weightKg`, {
    min: Number.MIN_VALUE,
    maxExclusive: MAX_BODYWEIGHT_KG,
  });
  if (value.note !== undefined) {
    assertString(value.note, `${path}.note`, {
      maxLength: LONG_TEXT_MAX_LENGTH,
    });
  }
  return value as unknown as BodyMeasurement;
};

const decode = <T>(
  value: unknown,
  documentName: string,
  validate: (candidate: unknown) => T
): T | null => {
  try {
    return validate(value);
  } catch (error) {
    if (!(error instanceof DatabaseValidationError)) {
      throw error;
    }
    console.error(
      `[Database] Dropped malformed ${documentName} document`,
      error
    );
    return null;
  }
};

export const decodeUserProfile = (value: unknown): UserProfile | null =>
  decode(value, 'user', validateUserProfile);

export const decodeExerciseCategory = (
  value: unknown
): ExerciseCategory | null =>
  decode(value, 'exercise category', validateExerciseCategory);

export const decodeEquipment = (value: unknown): Equipment | null =>
  decode(value, 'equipment', validateEquipment);

export const decodeExercise = (value: unknown): Exercise | null =>
  decode(value, 'exercise', validateExercise);

export const decodeCustomExerciseCategory = (
  value: unknown
): CustomExerciseCategory | null =>
  decode(value, 'custom exercise category', validateCustomExerciseCategory);

export const decodeCustomExercise = (value: unknown): CustomExercise | null =>
  decode(value, 'custom exercise', validateCustomExercise);

export const decodeWorkoutTemplate = (value: unknown): WorkoutTemplate | null =>
  decode(value, 'workout template', validateWorkoutTemplate);

export const decodeWorkout = (value: unknown): Workout | null =>
  decode(value, 'workout', validateWorkout);

export const decodeBodyMeasurement = (value: unknown): BodyMeasurement | null =>
  decode(value, 'body measurement', validateBodyMeasurement);

export function assertUserProfileWrite(
  value: unknown
): asserts value is UserProfile {
  validateUserProfile(value);
}

export function assertExerciseCategoryWrite(
  value: unknown
): asserts value is ExerciseCategory {
  validateExerciseCategory(value);
}

export function assertEquipmentWrite(
  value: unknown
): asserts value is Equipment {
  validateEquipment(value);
}

export function assertExerciseWrite(value: unknown): asserts value is Exercise {
  validateExercise(value);
}

export function assertCustomExerciseCategoryWrite(
  value: unknown
): asserts value is CustomExerciseCategory {
  validateCustomExerciseCategory(value);
}

export function assertCustomExerciseWrite(
  value: unknown
): asserts value is CustomExercise {
  validateCustomExercise(value);
}

export function assertWorkoutTemplateWrite(
  value: unknown
): asserts value is WorkoutTemplate {
  validateWorkoutTemplate(value);
}

export function assertWorkoutWrite(value: unknown): asserts value is Workout {
  validateWorkout(value);
}

export function assertBodyMeasurementWrite(
  value: unknown
): asserts value is BodyMeasurement {
  validateBodyMeasurement(value);
}
