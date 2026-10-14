import type { SortableLayout } from '../helpers/sortable-layout';
import type {
  LegendListRef,
  LegendListState,
} from '@legendapp/list/react-native';
import type { RefObject } from 'react';
import type { LayoutChangeEvent, ScrollView, View } from 'react-native';
import type { PanGesture } from 'react-native-gesture-handler';
import type {
  AnimatedRef,
  MeasuredDimensions,
  SharedValue,
  WithTimingConfig,
} from 'react-native-reanimated';
import {
  createContext,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  cancelAnimation,
  measure,
  useAnimatedReaction,
  useAnimatedRef,
  useDerivedValue,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { scheduleOnRN, scheduleOnUI } from 'react-native-worklets';

import {
  getDropOffset,
  getTargetIndex,
  moveItem,
} from '../helpers/sortable-layout';
import {
  DROP_DURATION_MS,
  SHIFT_DURATION_MS,
} from '../helpers/sortable-metrics';
import { useAutoScroll } from './use-auto-scroll';

/** No row is lifted. */
const DRAG_IDLE = 0;
/** A row asked to lift and the JS thread has not answered with a snapshot. */
const DRAG_PENDING = 1;
/** A row follows the finger. */
const DRAG_ACTIVE = 2;
/** The finger is up and the row is sliding into its slot. */
const DRAG_SETTLING = 3;

/**
 * `reduceMotion` is absent on purpose, here and on every other config in this
 * feature. Unset, it defaults to `ReduceMotion.System`, so the settle jumps to
 * its target when the OS setting is on and still runs its callback. See
 * `apps/mobile/src/features/calendar/hooks/use-expansion.ts`.
 */
const DROP_TIMING: WithTimingConfig = { duration: DROP_DURATION_MS };

/** The lifted look fades in over the same time a neighbour takes to shift. */
const LIFT_TIMING: WithTimingConfig = { duration: SHIFT_DURATION_MS };

/** The one move a drop produces. */
export interface SortableListMove {
  /** Index the row had before the drag. */
  from: number;
  /** Index the row has after the drop. */
  to: number;
  /** Key of the moved row. */
  key: string;
}

/** Row geometry for one drag, plus the lookup rows use to find themselves. */
export interface SortableSnapshot {
  /** Offsets and sizes in data order, the input of `sortable-layout.ts`. */
  layout: SortableLayout;
  /**
   * Index of each key in `layout`. A row reads its index from here and not
   * from the `index` it was rendered with, so one lookup serves every row and
   * no row depends on having re-rendered since the last reorder. A `Map`, so
   * a key such as `__proto__` is an ordinary entry.
   */
  indexByKey: ReadonlyMap<string, number>;
}

/** Where the overlay copy sits, relative to the list's frame. */
export interface SortableOverlayFrame {
  top: number;
  left: number;
  width: number;
}

/** The row whose copy the overlay renders. */
export interface SortableOverlay {
  /** Unique per drag, so the copy remounts and reports a fresh layout. */
  id: number;
  /** Key of the lifted row. */
  key: string;
  /** Index of the lifted row in the data the drag started with. */
  index: number;
  /** Position of the copy before any finger travel. */
  frame: SortableOverlayFrame;
}

/** What a row needs from the drag. The object is stable across renders. */
export interface SortableDragRows {
  /** Geometry of the drag in progress, or `null` when no row is lifted. */
  snapshot: SharedValue<SortableSnapshot | null>;
  /** Index of the lifted row, or -1. */
  activeIndex: SharedValue<number>;
  /** Slot the lifted row hovers over, or -1. */
  targetIndex: SharedValue<number>;
  /** Key of the row hidden behind its overlay copy, or `null`. */
  hiddenKey: SharedValue<string | null>;
  /** Worklet. Starts a drag for the row whose long press activated. */
  liftRow: (key: string, fingerY: number, row: MeasuredDimensions) => void;
  /** Worklet. Reports the finger position of the row's active pan. */
  moveRow: (key: string, fingerY: number) => void;
  /**
   * Worklet. Ends the row's drag. `commit` drops on the hovered slot, and
   * `false` returns the row to where it started.
   */
  endRow: (key: string, commit: boolean) => void;
}

/** What a row shares with the controls inside it. */
export interface SortableItemHandle {
  /** The row's long press pan, the gesture an exclusion relates itself to. */
  dragGesture: PanGesture;
  /** True while a touch that began inside an exclusion is on screen. */
  isExcluded: SharedValue<boolean>;
}

/**
 * Set by `SortableItem` and read by `SortableDragExclusion`. `null` outside a
 * sortable row.
 */
export const SortableItemContext = createContext<SortableItemHandle | null>(
  null
);

export interface SortableDragParams<T> {
  /** Items in display order. */
  data: readonly T[];
  /** Stable key of an item. */
  keyExtractor: (item: T, index: number) => string;
  /** Called once per drop that changes the order. */
  onReorder: (data: T[], move: SortableListMove) => void;
  /** Size assumed for a row before any row has been measured. */
  estimatedItemSize: number | undefined;
  /** Whether the scroll view insets its content for bars that cover it. */
  adjustsInsets: boolean;
  /** Called on the JS thread when a row lifts. */
  onLift: (() => void) | undefined;
  /** Called on the JS thread each time the slot under the lifted row changes. */
  onSlotChange: (() => void) | undefined;
}

export interface SortableDrag {
  /** Ref for the list, read for its layout state when a row lifts. */
  listRef: RefObject<LegendListRef | null>;
  /** Animated ref for the list's scroll view. */
  scrollRef: AnimatedRef<ScrollView>;
  /** Animated ref for the view that holds the list and the overlay. */
  containerRef: AnimatedRef<View>;
  /** Scroll offset of the list, written by the list on the UI thread. */
  scrollOffset: SharedValue<number>;
  /** The slice of the drag each row receives. */
  rows: SortableDragRows;
  /** The lifted row, or `null`. Drives the overlay and `alwaysRender`. */
  overlay: SortableOverlay | null;
  /** Vertical travel of the overlay copy from its frame. */
  overlayTranslateY: SharedValue<number>;
  /** 0 at rest, 1 when the overlay copy shows its lifted look. */
  lift: SharedValue<number>;
  /** `onLayout` of the overlay copy. Reveals it once it has a height. */
  onOverlayLayout: (event: LayoutChangeEvent) => void;
  /** Reports the safe area insets of the list's frame. */
  onInsetsChange: (top: number, bottom: number) => void;
  /** Reports that the list measured a row at a new size. */
  onItemSizeChanged: () => void;
}

/**
 * Reads every row's offset and size out of the list.
 *
 * The typings of `@legendapp/list` 3.3.3 declare `positionAtIndex` and
 * `sizeAtIndex` as returning `number`. At runtime both return `undefined`:
 * `sizeAtIndex` for a row that has never been measured, `positionAtIndex` for
 * an index the list has not laid out yet. The annotations below restore that.
 *
 * An unmeasured row takes the slot the list itself reserved for it, which is
 * the distance to the next row's position. Past the range the list has
 * positioned, it takes the mean of the measured sizes, and
 * `estimatedItemSize` when nothing is measured. These rows are far from the
 * drag, and the snapshot is rebuilt when the list measures them.
 */
const buildSnapshot = <T>(
  state: LegendListState,
  data: readonly T[],
  keyExtractor: (item: T, index: number) => string,
  estimatedItemSize: number
): SortableSnapshot => {
  let measuredTotal = 0;

  state.sizes.forEach((size) => {
    measuredTotal += size;
  });

  const fallbackSize =
    state.sizes.size > 0 ? measuredTotal / state.sizes.size : estimatedItemSize;

  const keys: string[] = [];
  const offsets: number[] = [];
  const sizes: number[] = [];
  const indexByKey = new Map<string, number>();
  let nextTop = 0;

  data.forEach((item, index) => {
    const key = keyExtractor(item, index);
    const position: number | undefined = state.positionAtIndex(index);
    const top = position ?? nextTop;
    const measured: number | undefined = state.sizeAtIndex(index);
    const following: number | undefined =
      index + 1 < data.length ? state.positionAtIndex(index + 1) : undefined;
    const slot = following === undefined ? 0 : following - top;
    const size = measured ?? (slot > 0 ? slot : fallbackSize);

    keys.push(key);
    offsets.push(top);
    sizes.push(size);
    indexByKey.set(key, index);
    nextTop = top + size;
  });

  return { layout: { keys, offsets, sizes }, indexByKey };
};

/**
 * The state and lifecycle of one list's drag: lift, update, drop, cancel.
 *
 * The data order never changes while a row is lifted. A snapshot of every
 * row's offset and size goes to the UI thread when the row lifts, the rows
 * shift with transforms derived from it, and `onReorder` fires once, after the
 * dropped row has settled.
 *
 * A drag moves through four phases on the UI thread:
 *
 * ```
 * IDLE -> PENDING    the long press activated; the JS thread builds the snapshot
 * PENDING -> ACTIVE  the snapshot arrived; the row follows the finger
 * ACTIVE -> SETTLING the finger is up; the overlay slides to the slot
 * SETTLING -> IDLE   the new data committed; transforms reset
 * ```
 *
 * **The reset runs from a layout effect keyed on `data`.** After a drop the
 * rows keep their shifts until the caller's new array commits, and the layout
 * effect of that same commit clears them, so the list's new positions and the
 * cleared transforms are queued for the UI thread together. Clearing earlier
 * shows the old order for a frame, and clearing later shows every shifted row
 * displaced twice. This is `flushVisualOrder` in `react-native-drax` 1.1.0.
 * The same effect ends a drag when `data` changes for any other reason, since
 * the snapshot no longer describes the list.
 *
 * **The dragged row's position in the list** is
 * `liftOffset + translationY + (scrollOffset - liftScroll)`: where it was at
 * the lift, plus the finger's travel, plus what the list has scrolled since.
 * The overlay copy sits outside the scroll view and needs the finger's travel
 * only.
 */
export const useSortableDrag = <T>({
  data,
  keyExtractor,
  onReorder,
  estimatedItemSize,
  adjustsInsets,
  onLift,
  onSlotChange,
}: SortableDragParams<T>): SortableDrag => {
  const listRef = useRef<LegendListRef>(null);
  const scrollRef = useAnimatedRef<ScrollView>();
  const containerRef = useAnimatedRef<View>();

  /**
   * `.get()` and `.set()` throughout, never `.value`: `react-hooks/immutability`
   * rejects assigning to `.value` on a shared value that reached a callback as
   * a hook dependency.
   */
  const phase = useSharedValue(DRAG_IDLE);
  /** Counts lifts. Each hold gets its id here, before the JS thread hears of it. */
  const dragId = useSharedValue(0);
  const snapshot = useSharedValue<SortableSnapshot | null>(null);
  const activeKey = useSharedValue<string | null>(null);
  const hiddenKey = useSharedValue<string | null>(null);
  const activeIndex = useSharedValue(-1);
  const targetIndex = useSharedValue(-1);
  const translationY = useSharedValue(0);
  const lift = useSharedValue(0);
  const scrollOffset = useSharedValue(0);
  /** The `data` version the UI thread has seen. A lift carries it to the JS thread. */
  const dataVersion = useSharedValue(0);

  /** Captured at the lift. All positions are in the coordinates of `measure`. */
  const liftFingerY = useSharedValue(0);
  const liftPageY = useSharedValue(0);
  const liftScroll = useSharedValue(0);
  const liftOffset = useSharedValue(0);
  const activeHeight = useSharedValue(0);
  const containerPageY = useSharedValue(0);
  const containerHeight = useSharedValue(0);

  /** Content length minus viewport length, before any inset. */
  const scrollRange = useSharedValue(0);
  const safeTop = useSharedValue(0);
  const safeBottom = useSharedValue(0);

  const [overlay, setOverlay] = useState<SortableOverlay | null>(null);
  const [settleCount, setSettleCount] = useState(0);

  /**
   * The drag the JS thread knows about, from snapshot to cleanup. `data` is
   * the array the snapshot was built from.
   */
  const dragRef = useRef<{
    id: number;
    key: string;
    data: readonly T[];
  } | null>(null);
  const refreshHandle = useRef<number | null>(null);
  /** Counts `data` arrays. `dataVersion` mirrors it on the UI thread. */
  const dataVersionRef = useRef(0);

  /**
   * The latest props, for callbacks that worklets hold on to. Reading them
   * through a ref keeps those callbacks, and with them every row's gesture,
   * identity-stable across renders.
   */
  const latest = useRef({
    data,
    keyExtractor,
    onReorder,
    estimatedItemSize,
    onLift,
    onSlotChange,
  });

  useLayoutEffect(() => {
    latest.current = {
      data,
      keyExtractor,
      onReorder,
      estimatedItemSize,
      onLift,
      onSlotChange,
    };
  });

  /** Stable JS-thread entry for the slot haptic the drag worklet schedules. */
  const notifySlotChange = useCallback(() => {
    latest.current.onSlotChange?.();
  }, []);

  const isDragging = useDerivedValue(() => phase.get() === DRAG_ACTIVE);

  /**
   * The visible list area and the scroll range, both widened by the safe area
   * when the scroll view insets its content. With
   * `contentInsetAdjustmentBehavior` the list rests at a negative offset under
   * a navigation bar, so 0 is not the top of the range.
   */
  const viewportTop = useDerivedValue(
    () => containerPageY.get() + (adjustsInsets ? safeTop.get() : 0)
  );
  const viewportBottom = useDerivedValue(
    () =>
      containerPageY.get() +
      containerHeight.get() -
      (adjustsInsets ? safeBottom.get() : 0)
  );
  const scrollMin = useDerivedValue(() => (adjustsInsets ? -safeTop.get() : 0));
  const scrollMax = useDerivedValue(() =>
    Math.max(
      scrollMin.get(),
      scrollRange.get() + (adjustsInsets ? safeBottom.get() : 0)
    )
  );

  const autoScroll = useAutoScroll({
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
  });

  /** Removes what `beginDrag` set up. Runs after the UI thread has reset. */
  const clearDrag = useCallback(() => {
    dragRef.current = null;

    if (refreshHandle.current !== null) {
      cancelAnimationFrame(refreshHandle.current);
      refreshHandle.current = null;
    }

    autoScroll.setActive(false);
    setOverlay(null);
  }, [autoScroll]);

  /**
   * One worklet, so every write lands on the same frame: the shifts clear, the
   * in-list row reappears and the overlay copy hides together. The copy
   * unmounts afterwards, from `clearDrag`.
   */
  const resetDrag = useCallback(() => {
    'worklet';
    cancelAnimation(translationY);
    cancelAnimation(lift);
    snapshot.set(null);
    activeKey.set(null);
    hiddenKey.set(null);
    activeIndex.set(-1);
    targetIndex.set(-1);
    translationY.set(0);
    lift.set(0);
    phase.set(DRAG_IDLE);
    scheduleOnRN(clearDrag);
  }, [
    activeIndex,
    activeKey,
    clearDrag,
    hiddenKey,
    lift,
    phase,
    snapshot,
    targetIndex,
    translationY,
  ]);

  /**
   * A lift that has not reached the JS thread yet leaves no drag for the
   * effect below to reset. Its row was measured in the old array, so
   * `beginDrag` compares the version the lift carries with this one and
   * abandons the lift when they differ.
   */
  useLayoutEffect(() => {
    dataVersionRef.current += 1;
    dataVersion.set(dataVersionRef.current);
  }, [data, dataVersion]);

  useLayoutEffect(() => {
    if (dragRef.current !== null) {
      scheduleOnUI(resetDrag);
    }
  }, [data, settleCount, resetDrag]);

  /**
   * `settleCount` changes on every drop, so the layout effect above also runs
   * when the row was dropped where it started and when the caller declined
   * the new order. A caller that applies the order later, in another render,
   * sees the rows return to the old order first.
   *
   * A drop queued for the JS thread can arrive after `data` has changed. The
   * layout effect has already scheduled the reset by then, and `from` and `to`
   * index the old array, so the drop is discarded.
   */
  const finishDrop = useCallback((id: number, from: number, to: number) => {
    const drag = dragRef.current;

    if (drag === null || drag.id !== id) return;
    if (latest.current.data !== drag.data) return;

    if (from !== to) {
      const props = latest.current;

      props.onReorder(moveItem(props.data, from, to), {
        from,
        to,
        key: drag.key,
      });
    }

    setSettleCount((count) => count + 1);
  }, []);

  /**
   * The finger can be gone before the JS thread answers, and a new hold can
   * have started in its place, on the same row. Only the lift `id` names
   * tells the two apart.
   */
  const activateDrag = useCallback(
    (id: number, index: number, next: SortableSnapshot, range: number) => {
      'worklet';
      if (phase.get() !== DRAG_PENDING || dragId.get() !== id) return;

      snapshot.set(next);
      activeIndex.set(index);
      targetIndex.set(index);
      liftOffset.set(next.layout.offsets[index] ?? 0);
      scrollRange.set(range);
      phase.set(DRAG_ACTIVE);
    },
    [activeIndex, dragId, liftOffset, phase, scrollRange, snapshot, targetIndex]
  );

  const abandonLift = useCallback(
    (id: number) => {
      'worklet';
      if (phase.get() !== DRAG_PENDING || dragId.get() !== id) return;

      activeKey.set(null);
      phase.set(DRAG_IDLE);
    },
    [activeKey, dragId, phase]
  );

  const beginDrag = useCallback(
    (id: number, version: number, key: string, frame: SortableOverlayFrame) => {
      if (version !== dataVersionRef.current) {
        scheduleOnUI(abandonLift, id);
        return;
      }

      const state = listRef.current?.getState();
      const props = latest.current;
      const next = state
        ? buildSnapshot(
            state,
            props.data,
            props.keyExtractor,
            props.estimatedItemSize ?? 0
          )
        : null;
      const index = next?.indexByKey.get(key);

      if (!state || !next || index === undefined) {
        scheduleOnUI(abandonLift, id);
        return;
      }

      dragRef.current = { id, key, data: props.data };
      setOverlay({ id, key, index, frame });
      autoScroll.setActive(true);
      scheduleOnUI(
        activateDrag,
        id,
        index,
        next,
        state.contentLength - state.scrollLength
      );
      latest.current.onLift?.();
    },
    [abandonLift, activateDrag, autoScroll]
  );

  const revealOverlay = useCallback(
    (id: number) => {
      'worklet';
      if (phase.get() !== DRAG_ACTIVE || dragId.get() !== id) return;
      if (hiddenKey.get() !== null) return;

      hiddenKey.set(activeKey.get());
      lift.set(withTiming(1, LIFT_TIMING));
    },
    [activeKey, dragId, hiddenKey, lift, phase]
  );

  /**
   * The in-list row hides only once its copy is laid out with a height, and
   * the hide and the reveal are one write (`hiddenKey`), so they share a
   * frame. Hiding at the lift would leave a gap for the frames the copy takes
   * to mount. A SwiftUI `Host` copy reports a zero height first, which is why
   * a bare `onLayout` is not enough. This ordering is `HoverLayer` in
   * `react-native-drax` 1.1.0.
   */
  const onOverlayLayout = useCallback(
    (event: LayoutChangeEvent) => {
      const drag = dragRef.current;

      if (drag === null || event.nativeEvent.layout.height <= 0) return;

      scheduleOnUI(revealOverlay, drag.id);
    },
    [revealOverlay]
  );

  const refreshSnapshot = useCallback(
    (id: number, next: SortableSnapshot, range: number) => {
      'worklet';
      if (phase.get() !== DRAG_ACTIVE || dragId.get() !== id) return;

      snapshot.set(next);
      scrollRange.set(range);
    },
    [dragId, phase, scrollRange, snapshot]
  );

  /**
   * Auto-scroll brings in rows the list had only estimated. When it measures
   * them, the rows below move and the content length changes, so the snapshot
   * is rebuilt, once per frame however many rows were measured.
   *
   * `liftOffset` stays as captured. The list corrects its scroll offset by
   * the same amount it moves the rows, so the dragged row's position formula
   * holds across the rebuild.
   */
  const onItemSizeChanged = useCallback(() => {
    if (dragRef.current === null || refreshHandle.current !== null) return;

    refreshHandle.current = requestAnimationFrame(() => {
      refreshHandle.current = null;

      const drag = dragRef.current;
      const state = listRef.current?.getState();

      if (drag === null || !state) return;

      const props = latest.current;

      scheduleOnUI(
        refreshSnapshot,
        drag.id,
        buildSnapshot(
          state,
          props.data,
          props.keyExtractor,
          props.estimatedItemSize ?? 0
        ),
        state.contentLength - state.scrollLength
      );
    });
  }, [refreshSnapshot]);

  useEffect(
    () => () => {
      if (refreshHandle.current !== null) {
        cancelAnimationFrame(refreshHandle.current);
      }
    },
    []
  );

  const onInsetsChange = useCallback(
    (top: number, bottom: number) => {
      safeTop.set(top);
      safeBottom.set(bottom);
    },
    [safeBottom, safeTop]
  );

  /**
   * Runs on finger travel and on scroll, so a still finger over a scrolling
   * list keeps changing slots.
   */
  useAnimatedReaction(
    () => {
      const current = snapshot.get();

      if (phase.get() !== DRAG_ACTIVE || current === null) return -1;

      return getTargetIndex(
        current.layout,
        activeIndex.get(),
        liftOffset.get() +
          translationY.get() +
          scrollOffset.get() -
          liftScroll.get()
      );
    },
    (next) => {
      if (next < 0 || next === targetIndex.get()) return;

      targetIndex.set(next);
      scheduleOnRN(notifySlotChange);
    }
  );

  const liftRow = useCallback(
    (key: string, fingerY: number, row: MeasuredDimensions) => {
      'worklet';
      // A second finger, or a new hold while the last drop is still settling.
      if (phase.get() !== DRAG_IDLE) return;

      const container = measure(containerRef);

      if (container === null) return;

      const id = dragId.get() + 1;
      const version = dataVersion.get();

      phase.set(DRAG_PENDING);
      dragId.set(id);
      activeKey.set(key);
      translationY.set(0);
      liftFingerY.set(fingerY);
      liftPageY.set(row.pageY);
      liftScroll.set(scrollOffset.get());
      activeHeight.set(row.height);
      containerPageY.set(container.pageY);
      containerHeight.set(container.height);
      scheduleOnRN(beginDrag, id, version, key, {
        top: row.pageY - container.pageY,
        left: row.pageX - container.pageX,
        width: row.width,
      });
    },
    [
      activeHeight,
      activeKey,
      beginDrag,
      containerHeight,
      containerPageY,
      containerRef,
      dataVersion,
      dragId,
      liftFingerY,
      liftPageY,
      liftScroll,
      phase,
      scrollOffset,
      translationY,
    ]
  );

  const moveRow = useCallback(
    (key: string, fingerY: number) => {
      'worklet';
      if (activeKey.get() !== key) return;

      const current = phase.get();

      if (current !== DRAG_PENDING && current !== DRAG_ACTIVE) return;

      translationY.set(fingerY - liftFingerY.get());
    },
    [activeKey, liftFingerY, phase, translationY]
  );

  /**
   * A cancelled drag takes the same path as a drop, aimed at the row's own
   * slot: the neighbours slide back, the copy returns, and `finishDrop` sees
   * `from === to` and fires no `onReorder`.
   */
  const endRow = useCallback(
    (key: string, commit: boolean) => {
      'worklet';
      if (activeKey.get() !== key) return;

      const current = phase.get();

      if (current === DRAG_PENDING) {
        activeKey.set(null);
        phase.set(DRAG_IDLE);
        scheduleOnRN(clearDrag);
        return;
      }

      const active = snapshot.get();

      if (current !== DRAG_ACTIVE || active === null) return;

      const id = dragId.get();
      const from = activeIndex.get();
      const to = commit ? targetIndex.get() : from;
      const destination =
        getDropOffset(active.layout, from, to) -
        liftOffset.get() -
        (scrollOffset.get() - liftScroll.get());

      phase.set(DRAG_SETTLING);
      targetIndex.set(to);
      lift.set(withTiming(0, DROP_TIMING));
      translationY.set(
        withTiming(destination, DROP_TIMING, (finished) => {
          'worklet';
          // `false` means `resetDrag` cut the settle short and already cleaned up.
          if (finished === true) {
            scheduleOnRN(finishDrop, id, from, to);
          }
        })
      );
    },
    [
      activeIndex,
      activeKey,
      clearDrag,
      dragId,
      finishDrop,
      lift,
      liftOffset,
      liftScroll,
      phase,
      scrollOffset,
      snapshot,
      targetIndex,
      translationY,
    ]
  );

  const rows = useMemo<SortableDragRows>(
    () => ({
      snapshot,
      activeIndex,
      targetIndex,
      hiddenKey,
      liftRow,
      moveRow,
      endRow,
    }),
    [activeIndex, endRow, hiddenKey, liftRow, moveRow, snapshot, targetIndex]
  );

  return {
    listRef,
    scrollRef,
    containerRef,
    scrollOffset,
    rows,
    overlay,
    overlayTranslateY: translationY,
    lift,
    onOverlayLayout,
    onInsetsChange,
    onItemSizeChanged,
  };
};
