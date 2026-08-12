import type { CalendarMarker } from '../types';
import { createContext } from 'react';

/**
 * What a day cell needs and the surface above it cannot hand down.
 *
 * A context rather than props: rows are memoized inside a virtualized pager, and
 * a memoized row is entitled to skip the re-render that would carry selection
 * down, whereas a context update reaches consumers regardless. Selection also
 * belongs to the caller ([types.ts](../types.ts)), so threading it through the
 * pager's data would rebuild the pages on every tap.
 */
export interface CalendarDayData {
  /** The controlled selection, `YYYY-MM-DD`. */
  selectedDateId: string;
  /** Markers indexed by local calendar ID; missing means none. */
  markersByDateId: ReadonlyMap<string, readonly CalendarMarker[]>;
}

const EMPTY_MARKERS: ReadonlyMap<string, readonly CalendarMarker[]> = new Map();

/**
 * The default is unreachable in the app — the wrapper always provides a value —
 * and exists so a day cell rendered outside it degrades to "nothing selected,
 * nothing marked" instead of throwing.
 */
export const CalendarDayContext = createContext<CalendarDayData>({
  selectedDateId: '',
  markersByDateId: EMPTY_MARKERS,
});
