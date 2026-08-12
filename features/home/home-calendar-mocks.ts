import type {
  CalendarDateMarkers,
  CalendarMarkerTone,
} from '@/features/calendar';

import { toLocalDateId } from '@/lib/format';

/**
 * Demonstration data for the Home calendar.
 *
 * The calendar feature takes markers as props and reads nothing; nothing here
 * touches Firestore, and selecting a day filters no Home content. Turning real
 * workouts into local day IDs is a separate piece of work with its own timezone
 * semantics — see the contract in
 * [calendar-types.ts](../calendar/calendar-types.ts) — and is deliberately not
 * guessed at here.
 */
export interface HomeCalendarMocks {
  /** Today, as the initially selected day. */
  selectedDateId: string;
  /** Marked days, relative to today. */
  dateMarkers: CalendarDateMarkers[];
}

/**
 * Days offset from today and the workouts on them.
 *
 * Chosen to exercise every case the day cell can draw: an unmarked day (every
 * offset absent from this list), one, two and three markers, more than three so
 * the overflow treatment renders, and markers under the selection circle where
 * the dots have to invert to stay legible. A future day is included because the
 * calendar pages forward as freely as back.
 */
const MOCK_WORKOUT_TONES: { dayOffset: number; tones: CalendarMarkerTone[] }[] =
  [
    { dayOffset: -6, tones: ['accent'] },
    { dayOffset: -4, tones: ['success', 'warning'] },
    { dayOffset: -3, tones: ['accent', 'success', 'warning'] },
    {
      dayOffset: -1,
      tones: ['accent', 'success', 'warning', 'accent', 'success'],
    },
    { dayOffset: 0, tones: ['success', 'accent'] },
    { dayOffset: 2, tones: ['accent'] },
  ];

export const buildHomeCalendarMocks = (today: Date): HomeCalendarMocks => ({
  selectedDateId: toLocalDateId(today),
  dateMarkers: MOCK_WORKOUT_TONES.map(({ dayOffset, tones }) => {
    const day = new Date(today);
    day.setDate(today.getDate() + dayOffset);
    const dateId = toLocalDateId(day);

    return {
      dateId,
      markers: tones.map((tone, index) => ({
        id: `${dateId}-${index}`,
        tone,
      })),
    };
  }),
});
