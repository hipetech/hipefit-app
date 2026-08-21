export const INITIAL_SCHEMA_VERSION = 1;

const PROFILE_KEYS = [
  'firstName',
  'lastName',
  'displayName',
  'email',
  'photoURL',
  'purpose',
  'createdAt',
  'updatedAt',
] as const;
const BODY_KEYS = ['birthDate', 'heightCm'] as const;
const SETTINGS_KEYS = [
  'theme',
  'language',
  'units',
  'hiddenExerciseRefs',
  'hiddenCategoryRefs',
] as const;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const pick = (
  source: Record<string, unknown>,
  keys: readonly string[]
): Record<string, unknown> =>
  Object.fromEntries(
    keys.filter((key) => key in source).map((key) => [key, source[key]])
  );

export const migrateInitialData = (
  profile: Record<string, unknown>
): Record<string, unknown> => ({
  ...pick(profile, PROFILE_KEYS),
  body: pick(isRecord(profile.body) ? profile.body : {}, BODY_KEYS),
  settings: pick(
    isRecord(profile.settings) ? profile.settings : {},
    SETTINGS_KEYS
  ),
  schemaVersion: INITIAL_SCHEMA_VERSION,
});
