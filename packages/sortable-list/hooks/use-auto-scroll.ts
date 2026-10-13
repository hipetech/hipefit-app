import type { ScrollView } from 'react-native';
import type {
  AnimatedRef,
  DerivedValue,
  FrameCallback,
  SharedValue,
} from 'react-native-reanimated';
import { scrollTo, useFrameCallback } from 'react-native-reanimated';

import { getAutoScrollVelocity } from '../helpers/sortable-layout';
import {
  AUTO_SCROLL_EDGE_SIZE,
  AUTO_SCROLL_MAX_SPEED,
} from '../helpers/sortable-metrics';

/**
 * Smallest scroll step per frame, in points. A slower step can round back to
 * the current offset, which would leave the list stuck at the outer edge of
 * the zone where the speed is near zero.
 */
const MIN_SCROLL_STEP = 1;

export interface AutoScrollParams {
  /** The list's scroll view, driven with `scrollTo` from the UI thread. */
  scrollRef: AnimatedRef<ScrollView>;
  /** True while a row follows the finger. Nothing scrolls otherwise. */
  isDragging: DerivedValue<boolean>;
  /** Current scroll offset of the list. */
  scrollOffset: SharedValue<number>;
  /** Finger travel since the lift, in points. */
  translationY: SharedValue<number>;
  /** Top edge of the row when it lifted, in the coordinates of `measure`. */
  liftPageY: SharedValue<number>;
  /** Finger position when the row lifted, in the same coordinates. */
  liftFingerY: SharedValue<number>;
  /** Height of the dragged row. */
  activeHeight: SharedValue<number>;
  /** Top of the visible list area, below any bar that covers the list. */
  viewportTop: DerivedValue<number>;
  /** Bottom of the visible list area, above any bar that covers the list. */
  viewportBottom: DerivedValue<number>;
  /** Scroll offset at which the first row rests at `viewportTop`. */
  scrollMin: DerivedValue<number>;
  /** Scroll offset at which the last row rests at `viewportBottom`. */
  scrollMax: DerivedValue<number>;
}

/**
 * Scrolls the list while the dragged row sits in an edge zone of the viewport.
 *
 * The edge test uses the dragged row's own edges, not the finger: its top edge
 * against the top zone and its bottom edge against the bottom zone, as
 * `useAutoScroll` in `react-native-draggable-flatlist` 4.0.3 does. A row
 * taller than the space between the zones touches both, so the finger decides
 * for it.
 *
 * A zone scrolls only once the finger has travelled towards it. A row lifted
 * while it already overlaps a zone stays put until the user moves it.
 *
 * Each step starts from the scroll view's reported offset and not from the
 * last requested one, so an offset correction the list makes while unmeasured
 * rows come into view is kept and not overwritten.
 *
 * The returned frame callback starts inactive. The drag turns it on for the
 * length of one drag.
 */
export const useAutoScroll = ({
  scrollRef,
  isDragging,
  scrollOffset,
  translationY,
  liftPageY,
  liftFingerY,
  activeHeight,
  viewportTop,
  viewportBottom,
  scrollMin,
  scrollMax,
}: AutoScrollParams): FrameCallback =>
  useFrameCallback((frame) => {
    'worklet';
    const elapsed = frame.timeSincePreviousFrame;

    if (!isDragging.get() || elapsed === null) return;

    const translation = translationY.get();
    const top = viewportTop.get();
    const bottom = viewportBottom.get();
    const rowTop = liftPageY.get() + translation;

    const towardsTop = getAutoScrollVelocity(
      rowTop,
      top,
      bottom,
      AUTO_SCROLL_EDGE_SIZE,
      AUTO_SCROLL_MAX_SPEED
    );
    const towardsBottom = getAutoScrollVelocity(
      rowTop + activeHeight.get(),
      top,
      bottom,
      AUTO_SCROLL_EDGE_SIZE,
      AUTO_SCROLL_MAX_SPEED
    );

    let velocity = 0;

    if (towardsTop < 0 && towardsBottom > 0) {
      velocity = getAutoScrollVelocity(
        liftFingerY.get() + translation,
        top,
        bottom,
        AUTO_SCROLL_EDGE_SIZE,
        AUTO_SCROLL_MAX_SPEED
      );
    } else if (towardsTop < 0) {
      velocity = towardsTop;
    } else if (towardsBottom > 0) {
      velocity = towardsBottom;
    }

    if (velocity === 0) return;
    if (velocity < 0 && translation >= 0) return;
    if (velocity > 0 && translation <= 0) return;

    const direction = velocity < 0 ? -1 : 1;
    const step =
      direction *
      Math.max(Math.abs((velocity * elapsed) / 1000), MIN_SCROLL_STEP);
    const current = scrollOffset.get();
    const next = Math.min(
      Math.max(current + step, scrollMin.get()),
      scrollMax.get()
    );

    // Past either end already, for example mid bounce: leave it to the list.
    if ((next - current) * direction <= 0) return;

    scrollTo(scrollRef, 0, next, false);
  }, false);
