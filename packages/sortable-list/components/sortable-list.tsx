import type { SortableListMove } from '../hooks/use-sortable-drag';
import type { AnimatedLegendListProps } from '@legendapp/list/reanimated';
import type React from 'react';
import type { ScrollView, StyleProp, ViewStyle } from 'react-native';
import { useCallback, useMemo } from 'react';
import { StyleSheet } from 'react-native';
import { AnimatedLegendList } from '@legendapp/list/reanimated';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';
import { SafeAreaListener } from 'react-native-safe-area-context';

import {
  LIFT_SCALE,
  LIFT_SHADOW_OFFSET_Y,
  LIFT_SHADOW_OPACITY,
  LIFT_SHADOW_RADIUS,
} from '../helpers/sortable-metrics';
import { useSortableDrag } from '../hooks/use-sortable-drag';
import { SortableItem } from './sortable-item';

export type { SortableListMove } from '../hooks/use-sortable-drag';

const styles = StyleSheet.create({
  fill: {
    flex: 1,
  },
  /**
   * The copy of the lifted row. `top`, `left` and `width` come from the row's
   * measured frame. It never takes a touch: the gesture stays with the row in
   * the list.
   */
  overlay: {
    position: 'absolute',
    pointerEvents: 'none',
    shadowColor: '#000',
    shadowRadius: LIFT_SHADOW_RADIUS,
    shadowOffset: { width: 0, height: LIFT_SHADOW_OFFSET_Y },
  },
});

/** What `renderItem` receives for one row. */
export interface SortableListRenderItemInfo<T> {
  /** The item to render. */
  item: T;
  /** Index of the item in `data`. */
  index: number;
  /**
   * True for the copy that follows the finger, false for every row in the
   * list. The copy already carries the list's scale and shadow, so use this
   * only for a lifted look of the row's own.
   */
  isActive: boolean;
}

export interface SortableListProps<T> {
  /**
   * Items in display order. The list never reorders them itself: the order on
   * screen changes when the caller passes a new array.
   */
  data: readonly T[];
  /** Stable, unique key of an item. It must not change when the item moves. */
  keyExtractor: (item: T, index: number) => string;
  /**
   * Renders one row. It is called a second time for the lifted row, to draw
   * the copy that follows the finger, so both calls must produce the same row
   * from the same input. State that changes a row's look or height belongs to
   * the caller, keyed by item, and not inside the row.
   */
  renderItem: (info: SortableListRenderItemInfo<T>) => React.ReactNode;
  /**
   * Called once per drop that changes the order, after the dropped row has
   * settled, with a new array and the move that produced it. Commit the array
   * in this call. The rows hold their dragged positions until `data` changes,
   * and a caller that commits later sees the old order return first.
   */
  onReorder: (data: T[], move: SortableListMove) => void;
  /**
   * Anything `renderItem` reads besides its item. Rows re-render when `data`
   * or this value changes identity, and not when `renderItem` does, so pass
   * the state the rows depend on here.
   */
  extraData?: unknown;
  /** Style of the list's outer frame. Give it the space the list fills. */
  style?: StyleProp<ViewStyle>;
  /** Style of the scroll content, such as the side margins of the rows. */
  contentContainerStyle?: AnimatedLegendListProps<T>['contentContainerStyle'];
  /** Row height assumed before a row is measured. */
  estimatedItemSize?: number;
  /**
   * How the scroll view insets its content for bars that cover it. With any
   * value but `'never'`, a drag scrolls and stops at the inset edges.
   * @default 'never'
   */
  contentInsetAdjustmentBehavior?: AnimatedLegendListProps<T>['contentInsetAdjustmentBehavior'];
  /** Rendered above the first row. It scrolls with the list. */
  ListHeaderComponent?: AnimatedLegendListProps<T>['ListHeaderComponent'];
  /** Rendered below the last row. It scrolls with the list. */
  ListFooterComponent?: AnimatedLegendListProps<T>['ListFooterComponent'];
  /** Rendered in place of the rows when `data` is empty. */
  ListEmptyComponent?: AnimatedLegendListProps<T>['ListEmptyComponent'];
  /**
   * Called when a row lifts. The package fires no feedback of its own, so
   * this is where the caller plays its lift haptic.
   */
  onLift?: () => void;
  /**
   * Called each time the slot under the lifted row changes, which is where
   * the caller plays its selection haptic. It does not fire on the drop.
   */
  onSlotChange?: () => void;
}

/**
 * A virtualized list whose rows reorder by drag.
 *
 * Holding a row lifts it, dragging moves it among rows of any height, and the
 * list scrolls while the row is near its top or bottom edge. The mechanism is
 * in `use-sortable-drag.ts`. Three choices shape this file:
 *
 * **The lifted row is drawn by a copy above the list.** `LegendList` puts each
 * row in its own absolutely positioned container, and those containers are
 * siblings this component does not render. `zIndex` on a row orders it inside
 * its own container only, so a row dragged in place would pass under every row
 * after it.
 *
 * **`recycleItems` stays off and `itemLayoutAnimation` stays unset.** Shifts
 * belong to an item key, and a recycled container would carry one row's shift
 * to another. `itemLayoutAnimation` leaves rows misaligned when items reorder
 * around a moving row (LegendApp/legend-list#513, checked at 3.3.3).
 *
 * **The scroll view must stay the first descendant of this component's
 * views.** The list is rendered before the overlay copy so UIKit still finds
 * it as the screen's scroll view for the navigation bar.
 */
export const SortableList = <T,>({
  data,
  keyExtractor,
  renderItem,
  onReorder,
  extraData,
  style,
  contentContainerStyle,
  estimatedItemSize,
  contentInsetAdjustmentBehavior,
  ListHeaderComponent,
  ListFooterComponent,
  ListEmptyComponent,
  onLift,
  onSlotChange,
}: SortableListProps<T>): React.ReactElement => {
  const adjustsInsets =
    contentInsetAdjustmentBehavior !== undefined &&
    contentInsetAdjustmentBehavior !== 'never';

  const {
    listRef,
    scrollRef,
    containerRef,
    rows,
    overlay,
    overlayTranslateY,
    lift,
    scrollOffset,
    onOverlayLayout,
    onInsetsChange,
    onItemSizeChanged,
  } = useSortableDrag({
    data,
    keyExtractor,
    onReorder,
    estimatedItemSize,
    adjustsInsets,
    onLift,
    onSlotChange,
  });
  const { hiddenKey } = rows;

  /**
   * `refScrollView` is typed `Ref<never>` in `@legendapp/list` 3.3.3: its
   * `React.ElementRef<typeof Reanimated.ScrollView>` resolves to `never`
   * against Reanimated 4.5, so an animated ref does not assign to it. A
   * callback ref does, and it hands the instance to the animated ref the way
   * the list's own combined ref would. It returns nothing, because React
   * treats a value returned from a ref callback as a cleanup function.
   */
  const attachScrollView = useCallback(
    (instance: ScrollView | null) => {
      scrollRef(instance);
    },
    [scrollRef]
  );

  const sharedValues = useMemo(() => ({ scrollOffset }), [scrollOffset]);

  /**
   * `LegendList` re-renders a row when its item or `extraData` changes
   * identity. A reorder leaves most items untouched while moving their
   * indices, so `data` is part of the token and every mounted row re-renders
   * with its new `index`.
   */
  const listExtraData = useMemo(() => ({ data, extraData }), [data, extraData]);

  /**
   * The lifted row owns the gesture. If the list unmounted it when it
   * scrolled out of view, the drag would end mid scroll.
   */
  const activeKey = overlay?.key;
  const alwaysRender = useMemo(
    () => (activeKey === undefined ? undefined : { keys: [activeKey] }),
    [activeKey]
  );

  const renderRow = useCallback(
    ({ item, index }: { item: T; index: number }) => (
      <SortableItem itemKey={keyExtractor(item, index)} rows={rows}>
        {renderItem({ item, index, isActive: false })}
      </SortableItem>
    ),
    [keyExtractor, renderItem, rows]
  );

  /**
   * `hiddenKey` drives this opacity and the in-list row's, so the copy appears
   * on the frame the row disappears, and the reverse after the drop.
   */
  const overlayStyle = useAnimatedStyle(() => {
    const lifted = lift.get();

    return {
      opacity: hiddenKey.get() === null ? 0 : 1,
      shadowOpacity: lifted * LIFT_SHADOW_OPACITY,
      transform: [
        { translateY: overlayTranslateY.get() },
        { scale: 1 + lifted * (LIFT_SCALE - 1) },
      ],
    };
  });

  // Skipped when `data` changed under the drag: the reset is already queued.
  const overlayItem = overlay === null ? undefined : data[overlay.index];
  const overlayCopy =
    overlay !== null &&
    overlayItem !== undefined &&
    keyExtractor(overlayItem, overlay.index) === overlay.key ? (
      <Animated.View
        key={overlay.id}
        style={[styles.overlay, overlay.frame, overlayStyle]}
        onLayout={onOverlayLayout}
        accessibilityElementsHidden
      >
        {renderItem({
          item: overlayItem,
          index: overlay.index,
          isActive: true,
        })}
      </Animated.View>
    ) : null;

  /**
   * `SafeAreaListener` reports the safe area of its own native view, which
   * has the scroll view's frame, so its insets are the ones
   * `contentInsetAdjustmentBehavior` applies for the navigation bar and the
   * tab bar. Neither the scroll event nor `getState()` exposes the adjusted
   * inset (checked at React Native 0.86 and `@legendapp/list` 3.3.3). It
   * provides no context, so `useSafeAreaInsets()` in a row is unaffected.
   */
  return (
    <SafeAreaListener
      style={style}
      onChange={({ insets }) => onInsetsChange(insets.top, insets.bottom)}
    >
      <Animated.View ref={containerRef} style={styles.fill}>
        <AnimatedLegendList
          ref={listRef}
          refScrollView={attachScrollView}
          sharedValues={sharedValues}
          style={styles.fill}
          contentContainerStyle={contentContainerStyle}
          contentInsetAdjustmentBehavior={contentInsetAdjustmentBehavior}
          // The `scrollTo` command clamps to the content and ignores the
          // adjusted inset (`RCTScrollViewComponentView.mm`, React Native
          // 0.86), so without this a drag could not scroll the first row out
          // from under the navigation bar. The drag clamps to the inset range.
          scrollToOverflowEnabled={adjustsInsets}
          data={data}
          keyExtractor={keyExtractor}
          renderItem={renderRow}
          extraData={listExtraData}
          estimatedItemSize={estimatedItemSize}
          alwaysRender={alwaysRender}
          onItemSizeChanged={onItemSizeChanged}
          ListHeaderComponent={ListHeaderComponent}
          ListFooterComponent={ListFooterComponent}
          ListEmptyComponent={ListEmptyComponent}
        />
        {overlayCopy}
      </Animated.View>
    </SafeAreaListener>
  );
};
