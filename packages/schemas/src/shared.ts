export interface Timestamp {
  readonly seconds: number;
  readonly nanoseconds: number;
  toDate(): Date;
  toMillis(): number;
}

export type Locale = 'en' | 'uk';
export type GlobalLocalizedText = { en: string } & Partial<
  Record<Locale, string>
>;
export type UserLocalizedText = Partial<Record<Locale, string>>;
export type Ref = `global:${string}` | `custom:${string}`;

export interface WithId<T> {
  id: string;
  data: T;
}
