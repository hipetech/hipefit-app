import type {
  GlobalLocalizedText,
  Locale,
  UserLocalizedText,
} from '@/database';

export const resolveGlobalText = (
  text: GlobalLocalizedText,
  locale: Locale
): string => text[locale] ?? text.en;

export const resolveUserText = (
  text: UserLocalizedText,
  locale: Locale,
  defaultLocale: Locale
): string => text[locale] ?? text[defaultLocale] ?? text.en ?? text.uk ?? '';
