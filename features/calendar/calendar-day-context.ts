import type { CalendarMarker } from './calendar-types';
import { createContext } from 'react';

/**
 * What a day cell needs and Wix cannot carry for it.
 *
 * The library's only per-day channel is its `markedDates` marking object, whose
 * fields are Wix's own vocabulary (`selected`, `dots`, `dotColor`, …). Routing
 * Hipefit markers through it would mean either abusing a colour field to smuggle
 * a tone name or casting a semantic `ColorValue` into a `string` — and it would
 * make the library the source of truth for selection, which is exactly what the
 * feature refuses to do.
 *
 * A context sidesteps both. It also fixes a subtler problem: Wix wraps every day
 * in `React.memo` with a hand-written comparator, so a re-render driven from
 * above can be swallowed. Context updates reach consumers regardless of a memo
 * ancestor, so a selection change always repaints.
 *
 * **Selection lives here, not in Wix's `state`.** `getState` in
 * `src/day-state-manager.js` marks a day `'selected'` when it equals the
 * *visible anchor*, which moves with every week and month page. Reading that
 * would let a swipe masquerade as a choice.
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
