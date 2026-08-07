/**
 * Geometry the calendar cannot choose freely, because Wix
 * `react-native-calendars@1.1314.0` already decided it.
 *
 * These are **read off the pinned dependency**, not designed. Re-read them
 * against the package after any version bump rather than re-deriving them:
 * `src/expandableCalendar/index.js` computes the expanded height as
 * `headerHeight + WEEK_HEIGHT * numberOfWeeks + KNOB_CONTAINER_HEIGHT` and
 * clips the animated wrapper with `overflow: 'hidden'`, so a week row that
 * draws taller than `WEEK_HEIGHT` loses the bottom of the last week of every
 * month. Everything else here exists to fit inside that number.
 */

/**
 * `WEEK_HEIGHT` in `src/expandableCalendar/index.js:26` at 1.1314.0. It is a
 * module constant with no prop or theme override, which is why the day cell is
 * sized to it instead of the other way round.
 */
export const CALENDAR_WEEK_HEIGHT = 46;

/**
 * The day cell — the whole tappable column, and Apple's 44pt minimum target.
 * One point of breathing room on each side of `CALENDAR_WEEK_HEIGHT`; the
 * library's own `weekVerticalMargin` (7pt) is themed to 0 to buy that room.
 */
export const CALENDAR_DAY_SIZE = 44;

/**
 * Horizontal inset of the seven columns. Matches the 16pt margin `insetGrouped`
 * gives the `List` below it, so the calendar's columns and the list's rows sit
 * on the same vertical rules. Wix defaults to 15pt in three separate
 * stylesheets (calendar container, week strip, static header); all three are
 * overridden to this one value in `calendar-theme.ts` — they must stay equal or
 * the collapsed week and the expanded month land on different column centres.
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
 * Cap on the day number's Dynamic Type growth.
 *
 * A documented deviation from [ui.md](../../docs/app/ui.md#typography): text
 * normally scales without a ceiling. It cannot here — the row height is Wix's
 * fixed 46pt (above), so an unbounded day number clips the last week row of the
 * expanded month at accessibility sizes. 1.4 keeps `title3` (25pt line) plus the
 * dot row inside `CALENDAR_DAY_SIZE`. This is a cap, **not**
 * `allowFontScaling={false}`: the number still grows with the user's setting up
 * to that point, and every other piece of calendar text scales freely because
 * the header measures itself.
 */
export const CALENDAR_DAY_NUMBER_MAX_SCALE = 1.4;
