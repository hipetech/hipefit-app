/**
 * The calendar feature's public contract.
 *
 * Deliberately vendor-free: the feature is implemented with Wix
 * `react-native-calendars`, and **none of that reaches a call site**. No
 * `CalendarProvider`, no `ExpandableCalendarProps`, no `DateData`, no marking
 * object, no theme key and no navigation enum is re-exported here or anywhere
 * outside `features/calendar/`. A consumer describes days and markers in
 * Hipefit's own words; the wrapper translates.
 *
 * Dates are **local calendar IDs** shaped `YYYY-MM-DD` — the day as the user's
 * device reckons it, never a UTC instant. Producing one from a Firestore
 * `Timestamp` is a separate concern with its own timezone semantics and is not
 * defined by this feature; see `@/lib/format`'s `toLocalDateId` for the only
 * conversion that exists today (a JS `Date` in local time).
 */

/**
 * Semantic weight of a workout marker. Tones map to the system status colors in
 * the dot renderer, not to a brand palette — the app has no brand color.
 */
export type CalendarMarkerTone = 'accent' | 'success' | 'warning';

/** One workout marker on one day. */
export interface CalendarMarker {
  /** Stable identity for the marker, used as its render key. */
  id: string;
  /** Status treatment for the dot. */
  tone: CalendarMarkerTone;
}

/** Every marker belonging to a single local calendar day. */
export interface CalendarDateMarkers {
  /** Local calendar ID, `YYYY-MM-DD`. */
  dateId: string;
  /**
   * Markers for that day, in render order. The visual layer caps how many dots
   * it draws, but the full count is always what accessibility announces.
   */
  markers: readonly CalendarMarker[];
}

export interface ExpandableWeeklyCalendarProps {
  /**
   * The selected day, `YYYY-MM-DD`. Selection is **controlled**: the calendar
   * never selects a day on its own, and paging weeks or months leaves this
   * untouched.
   */
  selectedDateId: string;
  /** Days that carry workout markers. Days absent from this list have none. */
  dateMarkers: readonly CalendarDateMarkers[];
  /**
   * Fired only by a day press — never by week/month paging, arrows or a
   * programmatic page change.
   */
  onDatePress: (dateId: string) => void;
}
