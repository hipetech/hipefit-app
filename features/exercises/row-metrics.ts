/**
 * Metrics shared by the Exercises list and its rows so the flat `LegendList`
 * reads as a single `insetGrouped` section.
 *
 * The screen is deliberately *not* a SwiftUI `List` (see `exercise-row.tsx`
 * for the reasoning), so the grouped look is reproduced by hand: the scroll
 * container supplies the 16pt side margins, each row paints
 * `secondarySystemGroupedBackground`, the first and last rows round their outer
 * corners, and the separator is inset past the leading glyph.
 */

/**
 * Corner radius of an `insetGrouped` section — **measured, not assumed**.
 *
 * The widely-quoted UIKit figure is 10pt, and this constant was originally set
 * to that. It is wrong on iOS 26: the QA pass scanned the top-left corner arc of
 * genuine `listStyle('insetGrouped')` cards on an iPhone 17 Pro / iOS 26.5 and
 * found ~20-25pt on Settings and ~20-24pt on Workouts, against ~8-10pt for this
 * screen's hand-rolled corners. Switching tabs visibly tightened the corners.
 * 22 is the midpoint of the two native measurements.
 *
 * Re-measure (don't re-derive) after any OS-level design refresh — this value
 * tracks whatever SwiftUI currently draws, not a documented constant.
 */
export const GROUPED_ROW_RADIUS = 22;

/**
 * Side margin of an `insetGrouped` section — **measured, not assumed**.
 *
 * The often-quoted UIKit figure is 20pt, which would make this screen narrower
 * than Home/Workouts/Settings (all real SwiftUI `listStyle('insetGrouped')`)
 * and read as the list resizing when you switch tabs. So the margin was
 * measured off the Phase 2.4 device pass instead of guessed: on an
 * iPhone 17 Pro / iOS 26.5 (402pt wide) the first fully-opaque card pixel on
 * Home, Workouts and Settings sits at **x = 16pt**, symmetric on the trailing
 * edge, on every scan line of the card stack. Exercises measures the same 16pt,
 * so the two idioms already line up — this constant is correct as written.
 *
 * Re-measure (don't re-derive) if the app ever ships to iPad or to a device
 * whose horizontal size class is regular: SwiftUI widens the inset there.
 */
export const GROUPED_SECTION_MARGIN = 16;

/**
 * Leading inset of the hairline separator: section padding (16) + the leading
 * glyph frame (22) + the gap between glyph and text (12).
 */
export const GROUPED_SEPARATOR_INSET = 50;

/** Fixed frame of the leading SF Symbol, so every row's text starts flush. */
export const ROW_GLYPH_SIZE = 22;
