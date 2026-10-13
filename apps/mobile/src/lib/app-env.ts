export type AppEnvironment = 'development' | 'staging' | 'production';

const resolveAppEnvironment = (value: string | undefined): AppEnvironment => {
  // Anything other than an exact match resolves to production, including an
  // unset variable. An EAS build has no root `.env.*` file to copy, so it
  // bundles without `EXPO_PUBLIC_APP_ENV` and must behave as production.
  if (value === 'development' || value === 'staging') return value;
  return 'production';
};

// Expo inlines `EXPO_PUBLIC_*` variables at bundle time only for a static
// member access. `process.env[name]` or a destructured `process.env` is not
// replaced and reads undefined at runtime.
export const appEnvironment: AppEnvironment = resolveAppEnvironment(
  process.env.EXPO_PUBLIC_APP_ENV
);

export const isDevelopmentEnvironment: boolean =
  appEnvironment === 'development';
