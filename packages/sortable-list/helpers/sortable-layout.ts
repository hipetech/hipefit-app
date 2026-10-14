/** Row geometry captured when a drag starts, in list content coordinates. */
export interface SortableLayout {
  /** Item keys in data order. */
  keys: string[];
  /** Top edge of each row, same order as `keys`. */
  offsets: number[];
  /** Height of each row, same order as `keys`. */
  sizes: number[];
}

/**
 * Reads a measurement that `noUncheckedIndexedAccess` types as possibly
 * missing. Callers clamp the index first, so the fallback is reached only for
 * an empty layout, where 0 keeps every result finite.
 */
const valueAt = (values: number[], index: number): number => {
  'worklet';
  return values[index] ?? 0;
};

const clampIndex = (layout: SortableLayout, index: number): number => {
  'worklet';
  return Math.min(Math.max(index, 0), Math.max(layout.keys.length - 1, 0));
};

const midpointAt = (layout: SortableLayout, index: number): number => {
  'worklet';
  return valueAt(layout.offsets, index) + valueAt(layout.sizes, index) / 2;
};

/**
 * Space between the row at `index` and the row after it. `offsets` come from
 * the list's own state and already include any gap, so the gap is read back
 * from them instead of assuming rows touch.
 */
const gapAfter = (layout: SortableLayout, index: number): number => {
  'worklet';
  return (
    valueAt(layout.offsets, index + 1) -
    valueAt(layout.offsets, index) -
    valueAt(layout.sizes, index)
  );
};

/**
 * Slot the dragged row occupies when its top edge is at `draggedTop`.
 *
 * The rule compares the dragged row's leading edge with a neighbour's
 * midpoint, both in the snapshot's unshifted coordinates: the bottom edge
 * against rows below, the top edge against rows above. An adjacent neighbour
 * is passed after the dragged row travels half that neighbour's height,
 * whatever its own height. A centre-to-centre rule would add half the dragged
 * row's height to that distance, so a tall row would have to travel far to
 * pass a short one.
 *
 * The comparisons are the ones in `useCellTranslate` from
 * `react-native-draggable-flatlist` 4.0.3, applied to the whole layout in one
 * pass instead of per cell.
 *
 * Only the side the row has moved towards is searched, so a row at its
 * original offset always keeps its slot, even beside a zero-height neighbour
 * whose midpoint coincides with the dragged row's edge.
 */
export const getTargetIndex = (
  layout: SortableLayout,
  activeIndex: number,
  draggedTop: number
): number => {
  'worklet';
  const count = layout.keys.length;
  const active = clampIndex(layout, activeIndex);
  const activeTop = valueAt(layout.offsets, active);
  let target = active;

  if (draggedTop > activeTop) {
    const draggedBottom = draggedTop + valueAt(layout.sizes, active);

    for (let index = active + 1; index < count; index += 1) {
      if (draggedBottom < midpointAt(layout, index)) break;
      target = index;
    }
  } else if (draggedTop < activeTop) {
    for (let index = active - 1; index >= 0; index -= 1) {
      if (draggedTop > midpointAt(layout, index)) break;
      target = index;
    }
  }

  return target;
};

/**
 * Vertical shift of the row at `index` while the active row hovers over
 * `targetIndex`.
 *
 * Rows between the active index and the target index give up one slot to the
 * active row: up when it moves down, down when it moves up. The distance is
 * the active row's size plus the gap on the side the row moves away from, so
 * every gap stays where the list put it. With no gap between rows this is
 * exactly the active row's size. Every other row, the active one included,
 * shifts by 0.
 */
export const getItemShift = (
  layout: SortableLayout,
  index: number,
  activeIndex: number,
  targetIndex: number
): number => {
  'worklet';
  const active = clampIndex(layout, activeIndex);
  const target = clampIndex(layout, targetIndex);
  const activeSize = valueAt(layout.sizes, active);

  if (index > active && index <= target) {
    return -(activeSize + gapAfter(layout, index - 1));
  }

  if (index < active && index >= target) {
    return activeSize + gapAfter(layout, index);
  }

  return 0;
};

/**
 * Top edge the active row settles at when dropped on `targetIndex`.
 *
 * Moving down, the active row ends where the target row's bottom edge was, so
 * it is bottom-aligned with that row's original frame. Moving up, it takes the
 * target row's original top edge. Both follow from the shifts in
 * `getItemShift`, which is what makes the dropped row land flush against its
 * new neighbours.
 */
export const getDropOffset = (
  layout: SortableLayout,
  activeIndex: number,
  targetIndex: number
): number => {
  'worklet';
  const active = clampIndex(layout, activeIndex);
  const target = clampIndex(layout, targetIndex);

  if (target > active) {
    return (
      valueAt(layout.offsets, target) +
      valueAt(layout.sizes, target) -
      valueAt(layout.sizes, active)
    );
  }

  return valueAt(layout.offsets, target);
};

/**
 * Signed scroll speed in points per second for a pointer near a viewport edge,
 * else 0.
 *
 * Negative near the top edge and positive near the bottom. The speed grows
 * linearly with the pointer's depth into the edge zone and reaches `maxSpeed`
 * at the viewport edge and beyond it. The zone is capped at half the viewport
 * so the top and bottom zones cannot overlap in a short list.
 */
export const getAutoScrollVelocity = (
  pointerY: number,
  viewportTop: number,
  viewportBottom: number,
  edgeSize: number,
  maxSpeed: number
): number => {
  'worklet';
  const zone = Math.min(edgeSize, (viewportBottom - viewportTop) / 2);

  if (zone <= 0) return 0;

  const topDepth = viewportTop + zone - pointerY;

  if (topDepth > 0) return -maxSpeed * Math.min(topDepth / zone, 1);

  const bottomDepth = pointerY - (viewportBottom - zone);

  if (bottomDepth > 0) return maxSpeed * Math.min(bottomDepth / zone, 1);

  return 0;
};

/** New array with the item at `from` moved to `to`. Does not mutate `data`. */
export const moveItem = <T>(
  data: readonly T[],
  from: number,
  to: number
): T[] => {
  const next = [...data];

  if (from < 0 || from >= next.length) return next;

  const target = Math.min(Math.max(to, 0), next.length - 1);

  next.splice(target, 0, ...next.splice(from, 1));

  return next;
};
