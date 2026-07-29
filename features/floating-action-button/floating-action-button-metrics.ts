/**
 * Geometry for the floating create button.
 *
 * Every value is **measured, not derived** — there is no API for any of it
 * (Expo lists "cannot measure the tab bar height" as a known native-tabs
 * limitation). Same discipline as `features/exercises/row-metrics.ts`.
 *
 * Source: accessibility-tree rects on an iPhone 17 Pro / iOS 26.5 sim (402×874)
 * with the app's own `NativeTabs` on screen:
 *
 * ```
 * TabBar container   x=0    y=791  w=402  h=83
 * Home    (item)     x=25   y=795  w=95   h=54
 * Settings(item)     x=282  y=795  w=95   h=54   → right edge 377
 * ```
 *
 * The items end at x=377 of 402, leaving 25pt — so a 60pt circle *beside* the
 * bar (what Figma draws) would cover the Settings item. Hence floating above
 * it; `UITabBar` spreads items full-width and offers no way to open a gutter.
 *
 * Re-measure if the bar gains or loses an item, on iPad or any regular
 * horizontal size class, or after an OS design refresh.
 */

/** Height of the visible floating tab bar pill. Measured: 54pt. */
export const TAB_BAR_HEIGHT = 54;

/**
 * Gap between the tab bar pill and the bottom of the screen. Measured: 25pt.
 * Do *not* add `useSafeAreaInsets().bottom` — on iOS 26 the floating bar is
 * already inset within the safe area, so that double-counts it.
 */
export const TAB_BAR_BOTTOM_GAP = 25;

/** Diameter of the button. From the Figma mockup (node `377:4712`). */
export const FLOATING_ACTION_BUTTON_SIZE = 60;

/** Breathing room between the button's bottom edge and the tab bar's top edge. */
export const FLOATING_ACTION_BUTTON_TAB_BAR_GAP = 12;

/**
 * Trailing margin. Measured so the button's right edge lines up with the tab
 * bar pill's right edge (402 − 381 = 21) rather than the screen edge.
 */
export const FLOATING_ACTION_BUTTON_TRAILING_INSET = 21;

/**
 * Distance from the bottom of the screen to the bottom of the button:
 * 25 + 54 + 12 = 91pt.
 */
export const FLOATING_ACTION_BUTTON_BOTTOM_INSET =
  TAB_BAR_BOTTOM_GAP + TAB_BAR_HEIGHT + FLOATING_ACTION_BUTTON_TAB_BAR_GAP;

/**
 * Full height of the tab bar's *container* — pill plus the gap beneath it.
 * Measured: 83pt. UIKit already subtracts this from a scroll view via
 * `contentInsetAdjustmentBehavior="automatic"`, so it has to be subtracted back
 * out below.
 */
export const TAB_BAR_CONTAINER_HEIGHT = 83;

/**
 * Extra bottom padding a scrolling list needs so its last row clears the
 * button: 91 + 60 + 12 − 83 = 80pt. Without it the final row scrolls under the
 * circle and loses its trailing hit area.
 *
 * Only wired into the Exercises `LegendList` today — `@expo/ui` exposes no
 * content-inset hook on SwiftUI `List`, and no `List` screen currently scrolls
 * past the fold. If one grows, don't fake it with an empty trailing `Section`;
 * that paints a visible blank card.
 */
export const FLOATING_ACTION_BUTTON_CONTENT_INSET =
  FLOATING_ACTION_BUTTON_BOTTOM_INSET +
  FLOATING_ACTION_BUTTON_SIZE +
  FLOATING_ACTION_BUTTON_TAB_BAR_GAP -
  TAB_BAR_CONTAINER_HEIGHT;
