import type { UserSettings } from '@hipefit/schemas';

import { kilogramsToPounds, poundsToKilograms } from '@/lib/format';

/**
 * Conversion between the units a user enters and sees and the units the schema
 * stores. Stored weight is kilograms, distance is meters, and duration is
 * seconds. Weight is entered in kilograms or pounds, distance in kilometers or
 * miles, and duration in minutes under either system. The pound factor lives
 * in `format.ts`, which already exports the kilogram and pound conversions.
 */

export type UnitSystem = UserSettings['units'];

const METERS_PER_KILOMETER = 1000;
const METERS_PER_MILE = 1609.344;
const SECONDS_PER_MINUTE = 60;

/** Short labels for the units a set row displays. */
export interface UnitLabels {
  weight: string;
  distance: string;
  duration: string;
}

const UNIT_LABELS: Record<UnitSystem, UnitLabels> = {
  metric: { weight: 'kg', distance: 'km', duration: 'min' },
  imperial: { weight: 'lb', distance: 'mi', duration: 'min' },
};

export const getUnitLabels = (units: UnitSystem): UnitLabels =>
  UNIT_LABELS[units];

/** A weight in the user's units (kg or lb) as kilograms. */
export const toStoredWeight = (value: number, units: UnitSystem): number =>
  units === 'imperial' ? poundsToKilograms(value) : value;

/** Kilograms as a weight in the user's units (kg or lb). */
export const fromStoredWeight = (
  kilograms: number,
  units: UnitSystem
): number => (units === 'imperial' ? kilogramsToPounds(kilograms) : kilograms);

/** A distance in the user's units (km or mi) as meters. */
export const toStoredDistance = (value: number, units: UnitSystem): number =>
  value * (units === 'imperial' ? METERS_PER_MILE : METERS_PER_KILOMETER);

/** Meters as a distance in the user's units (km or mi). */
export const fromStoredDistance = (meters: number, units: UnitSystem): number =>
  meters / (units === 'imperial' ? METERS_PER_MILE : METERS_PER_KILOMETER);

/** Minutes as seconds. Duration is entered in minutes under both systems. */
export const toStoredDuration = (minutes: number): number =>
  minutes * SECONDS_PER_MINUTE;

/** Seconds as minutes. */
export const fromStoredDuration = (seconds: number): number =>
  seconds / SECONDS_PER_MINUTE;
