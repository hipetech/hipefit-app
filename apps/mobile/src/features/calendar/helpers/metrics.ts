/** The calendar's geometry. Design values, free to change together. */

/**
 * The pitch of one week row, and the unit the expand/collapse clip counts in.
 * Both the container height and the grid's `translateY` interpolate from it, so
 * it has to be known before the first frame — see
 * `CALENDAR_DAY_NUMBER_MAX_SCALE`.
 */
export const CALENDAR_WEEK_HEIGHT = 48;

/**
 * The day cell — the selection circle, and Apple's 44pt minimum target. Two
 * points of breathing room on each side of `CALENDAR_WEEK_HEIGHT`.
 */
export const CALENDAR_DAY_SIZE = 44;

/**
 * Horizontal inset of the seven columns. Matches the 16pt margin `insetGrouped`
 * gives the `List` below it, so the calendar's columns and the list's rows sit
 * on the same vertical rules.
 */
export const CALENDAR_HORIZONTAL_INSET = 16;

/** Diameter of one workout dot. */
export const CALENDAR_MARKER_DOT_SIZE = 6;

/** Gap between adjacent workout dots. */
export const CALENDAR_MARKER_DOT_GAP = 3;

/**
 * How many dot positions a day can draw. Beyond this the last position becomes
 * an overflow pill — the count itself is never truncated for VoiceOver.
 */
export const CALENDAR_MAX_VISIBLE_MARKERS = 3;

/**
 * Cap on the day number's Dynamic Type growth: a documented deviation from
 * [ui.md](../../../docs/app/ui.md#typography), where text scales uncapped.
 * `CALENDAR_WEEK_HEIGHT` is the constant the expansion animation interpolates
 * over, and an uncapped number makes the true row pitch a function of the user's
 * text size — discoverable only by measuring a row and feeding it back into a
 * shared value. 1.4 keeps `title3` plus the dot row inside `CALENDAR_DAY_SIZE`,
 * and only text inside the clip is capped. Removing it is tracked in
 * [the plan](../../../docs/plans/flash-calendar-rewrite/plan.md#follow-up-decisions).
 */
export const CALENDAR_DAY_NUMBER_MAX_SCALE = 1.4;

/** Root test ID. */
export const CALENDAR_TEST_ID = 'weekly-calendar';

/**
 * The tallest a month grid can be: a 31-day month starting on a Saturday needs
 * six Sunday-first rows. The pager is this tall **always**, because it lives
 * inside the clip and a self-sizing pager would re-measure on every frame of the
 * spring. Shorter months are handled by the clip stopping early.
 */
export const CALENDAR_MAX_WEEKS_IN_MONTH = 6;
