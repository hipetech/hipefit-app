/**
 * The calendar feature's public contract. Deliberately vendor-free — nothing
 * from `@marceloterreiro/flash-calendar` reaches a call site, and every type
 * below survived the swap of the underlying engine unchanged. Dates are **local
 * calendar IDs** shaped `YYYY-MM-DD`, never a UTC instant.
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
