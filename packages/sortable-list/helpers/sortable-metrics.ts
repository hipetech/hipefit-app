/**
 * Timing and geometry of a drag in `SortableList`.
 *
 * **Every value here is a starting estimate, not a measurement.** None has
 * been tuned on a device or a simulator. Tune them there, then record the
 * device, the OS and what was observed beside each value, the way
 * `apps/mobile/src/features/exercises/row-metrics.ts` does. Until then do
 * not cite these numbers as measured.
 */

/**
 * How long a finger must rest on a row before the row lifts, in milliseconds.
 * Estimate: the default long press delay of `react-native-drax` 1.1.0.
 *
 * It must stay below the 500ms default of a React Native `Pressable`
 * `onLongPress`, or a pressable inside a row fires before the row lifts.
 */
export const LIFT_DELAY_MS = 250;

/**
 * Duration of the slide a row makes when it gives up its slot, in
 * milliseconds. Estimate: the default shift animation of `react-native-drax`
 * 1.1.0. It is under the 300ms ceiling `docs/app/ui.md` puts on motion.
 */
export const SHIFT_DURATION_MS = 200;

/**
 * Duration of the dropped row's settle into its slot, in milliseconds.
 * Estimate, matched to `SHIFT_DURATION_MS` so the row and its neighbours come
 * to rest together.
 */
export const DROP_DURATION_MS = 200;

/**
 * Height of the zone at the top and bottom of the viewport in which the list
 * scrolls under a dragged row, in points. Estimate.
 */
export const AUTO_SCROLL_EDGE_SIZE = 72;

/**
 * Scroll speed at the viewport edge, in points per second. The speed ramps up
 * to it across the edge zone. Estimate.
 */
export const AUTO_SCROLL_MAX_SPEED = 900;

/** Scale of the lifted row. Estimate. */
export const LIFT_SCALE = 1.03;

/** Shadow opacity under the lifted row. Estimate. */
export const LIFT_SHADOW_OPACITY = 0.2;

/** Shadow blur radius under the lifted row, in points. Estimate. */
export const LIFT_SHADOW_RADIUS = 12;

/** Downward shadow offset under the lifted row, in points. Estimate. */
export const LIFT_SHADOW_OFFSET_Y = 6;
