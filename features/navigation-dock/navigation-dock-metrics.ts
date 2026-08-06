/**
 * Where the action panel sits relative to the system tab bar.
 *
 * Every value is **measured, not derived** — there is no API for any of it. Expo
 * lists "cannot measure the tab bar height" as a known native-tabs limitation,
 * and the panel is a sibling overlay rather than a child of the navigator, so it
 * has nothing to ask. Same discipline as `features/exercises/row-metrics.ts`.
 *
 * Source: accessibility-tree rects on an iPhone 17 Pro / iOS 26.5 sim (402×874)
 * with the app's own `NativeTabs` on screen:
 *
 * ```
 * TabBar container   x=0    y=791  w=402  h=83
 * Home    (item)     x=25   y=795  w=95   h=54
 * ```
 *
 * **This file is smaller than it was.** It used to also carry the geometry of a
 * floating create button that this app drew itself, including the extra bottom
 * padding a list needed so its last row cleared that button. The button is now a
 * `role="search"` tab bar item, drawn and placed by UIKit beside the bar, so
 * none of that is ours to position any more — and no list needs extra padding,
 * because `contentInsetAdjustmentBehavior` already accounts for the tab bar and
 * nothing else floats above it.
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

/**
 * Distance from the bottom of the screen to the **top edge of the tab bar
 * pill**: 25 + 54 = 79pt.
 *
 * It does two jobs in the native view, which is why it is one number rather than
 * two: the action panel is anchored above it, and the dimming scrim stops at it
 * so the tab bar and the Create circle stay lit and tappable while the panel is
 * open — the reference behaviour.
 */
export const NAVIGATION_DOCK_BOTTOM_INSET = TAB_BAR_BOTTOM_GAP + TAB_BAR_HEIGHT;
