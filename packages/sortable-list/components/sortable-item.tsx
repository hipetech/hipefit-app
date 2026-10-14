import type {
  SortableDragRows,
  SortableItemHandle,
} from '../hooks/use-sortable-drag';
import type React from 'react';
import type { View } from 'react-native';
import type { WithTimingConfig } from 'react-native-reanimated';
import { useMemo } from 'react';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  measure,
  useAnimatedReaction,
  useAnimatedRef,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { getItemShift } from '../helpers/sortable-layout';
import { LIFT_DELAY_MS, SHIFT_DURATION_MS } from '../helpers/sortable-metrics';
import { SortableItemContext } from '../hooks/use-sortable-drag';

/** `reduceMotion` is absent on purpose. See `DROP_TIMING` in the drag hook. */
const SHIFT_TIMING: WithTimingConfig = { duration: SHIFT_DURATION_MS };

export interface SortableItemProps {
  /** Key of the row's item, from the list's `keyExtractor`. */
  itemKey: string;
  /** The list's drag state and handlers. Stable across renders. */
  rows: SortableDragRows;
  /** The row the caller rendered. */
  children: React.ReactNode;
}

/**
 * The wrapper `SortableList` puts around every row.
 *
 * It owns the long press pan that lifts the row, slides the row aside while
 * another row is dragged past it, and hides the row while its copy is in the
 * overlay. The hidden row stays mounted and keeps the gesture: a touch stays
 * with the view it began on, whatever that view's opacity becomes.
 *
 * `activateAfterLongPress` leaves a quick pan to the scroll view and a tap to
 * the row's content. The pan fails when the finger moves more than 10 points
 * before the delay is up (`RNPanHandler.m`, `react-native-gesture-handler`
 * 2.32).
 *
 * **A touch that begins inside a `SortableDragExclusion` must not lift the
 * row, and the exclusion's gesture relation does not guarantee that by
 * itself.** On iOS the long press timer of this pan emits its ACTIVE event
 * directly (`activateAfterLongPress` in `RNPanHandler.m`), without waiting for
 * the recognizers it was told to wait for. So the exclusion also raises
 * `isExcluded`, and it is checked twice: at touch down, where failing the pan
 * stops the timer, and again in `onStart`, because the two recognizers see the
 * touch down in an order UIKit does not promise.
 */
export const SortableItem: React.FC<SortableItemProps> = ({
  itemKey,
  rows,
  children,
}) => {
  const {
    snapshot,
    activeIndex,
    targetIndex,
    hiddenKey,
    liftRow,
    moveRow,
    endRow,
  } = rows;

  const rowRef = useAnimatedRef<View>();
  const isExcluded = useSharedValue(false);
  const shift = useSharedValue(0);

  const dragGesture = useMemo(
    () =>
      Gesture.Pan()
        .activateAfterLongPress(LIFT_DELAY_MS)
        .onTouchesDown((_event, stateManager) => {
          'worklet';
          if (isExcluded.get()) {
            stateManager.fail();
          }
        })
        .onStart((event) => {
          'worklet';
          if (isExcluded.get()) return;

          const row = measure(rowRef);

          if (row === null) return;

          // `absoluteY`, not `translationY`: the translation counts from the
          // touch down, and the finger may have drifted before the lift.
          liftRow(itemKey, event.absoluteY, row);
        })
        .onUpdate((event) => {
          'worklet';
          moveRow(itemKey, event.absoluteY);
        })
        .onEnd((_event, success) => {
          'worklet';
          endRow(itemKey, success);
        })
        // Covers a pan that ends without `onEnd`. After a drop it finds the
        // drag already settling and does nothing.
        .onFinalize(() => {
          'worklet';
          endRow(itemKey, false);
        }),
    [endRow, isExcluded, itemKey, liftRow, moveRow, rowRef]
  );

  /**
   * `null` while no row is lifted. A change to or from `null` is applied
   * outright: the reset after a drop has to land on the frame the list commits
   * its new positions, and a row that mounts mid drag has to appear already
   * shifted. Every other change slides.
   */
  useAnimatedReaction(
    () => {
      const current = snapshot.get();

      if (current === null) return null;

      const index = current.indexByKey.get(itemKey);

      if (index === undefined) return 0;

      return getItemShift(
        current.layout,
        index,
        activeIndex.get(),
        targetIndex.get()
      );
    },
    (next, previous) => {
      if (next === previous) return;

      if (next === null || previous === null) {
        shift.set(next ?? 0);
      } else {
        shift.set(withTiming(next, SHIFT_TIMING));
      }
    }
  );

  const rowStyle = useAnimatedStyle(() => ({
    opacity: hiddenKey.get() === itemKey ? 0 : 1,
    transform: [{ translateY: shift.get() }],
  }));

  const handle = useMemo<SortableItemHandle>(
    () => ({ dragGesture, isExcluded }),
    [dragGesture, isExcluded]
  );

  return (
    <GestureDetector gesture={dragGesture}>
      <Animated.View ref={rowRef} style={rowStyle}>
        <SortableItemContext.Provider value={handle}>
          {children}
        </SortableItemContext.Provider>
      </Animated.View>
    </GestureDetector>
  );
};
