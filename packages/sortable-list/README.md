# `@hipefit/sortable-list`

A virtualized React Native list whose rows reorder by drag. It wraps `AnimatedLegendList` from
`@legendapp/list/reanimated` and adds the gesture with `react-native-gesture-handler` and
`react-native-reanimated`. The user holds a row to lift it and drags it among rows of any height,
and the list scrolls while the row is near its top or bottom edge.

The rules for using it in the app, including when a SwiftUI `List` is the better choice, are in
[`docs/app/ui.md`](../../docs/app/ui.md#the-sortable-list).

## Package layout

```text
sortable-list/
├── components/   SortableList, the per-row wrapper, and the drag exclusion wrapper
├── helpers/      pure slot math and the tuning constants
├── hooks/        the drag lifecycle and the edge auto-scroll
└── index.ts      public components and type exports
```

Consumers import only from `@hipefit/sortable-list`; subdirectory paths are internal.

## Render a list

The caller owns the order. `SortableList` never reorders `data` itself: it calls `onReorder` once
per drop, after the dropped row has settled, and the caller commits the new array in that call.

```tsx
const [items, setItems] = useState<Item[]>(initialItems);

<SortableList
  data={items}
  keyExtractor={(item) => item.id}
  renderItem={({ item }) => <ItemRow item={item} />}
  onReorder={(next) => setItems(next)}
  onLift={hapticLift}
  onSlotChange={hapticSelection}
  extraData={expandedIds}
  estimatedItemSize={72}
/>;
```

- `keyExtractor` must return a key that does not change when the item moves.
- `renderItem` is called a second time for the lifted row, with `isActive: true`, to draw the copy
  that follows the finger. Both calls must draw the same row, so state that changes a row's look or
  height lives in the caller, keyed by item.
- `extraData` carries that state. Rows re-render when `data` or `extraData` changes identity, and
  not when `renderItem` does.
- A new `data` array while a row is lifting, lifted, or settling ends the drag without calling
  `onReorder`, and the rows return to the new array's order. The user holds the row again to drag
  it.
- `onLift` and `onSlotChange` are where the caller plays feedback. The package fires none of its
  own, so it does not depend on a haptics module.
- With `contentInsetAdjustmentBehavior` set to anything but `'never'`, a drag scrolls and stops at
  the safe area edges of the list's frame.

A `GestureHandlerRootView` must be mounted above the list.

## Controls with their own long press

A control inside a row that has its own long press goes inside `SortableDragExclusion`. A touch that
starts inside the wrapper never lifts the row.

```tsx
<SortableDragExclusion>
  <Pressable onLongPress={openMenu}>
    <Text>Hold</Text>
  </Pressable>
</SortableDragExclusion>
```

The wrapper is a React Native view. A native child view that draws its own content, such as a
SwiftUI host, goes inside the wrapper as a whole.

## Constraints

- `recycleItems` stays off. Shifts belong to an item key, and a recycled container would carry one
  row's shift to another.
- `itemLayoutAnimation` stays unset. It leaves rows misaligned when items reorder around a moving
  row ([LegendApp/legend-list#513](https://github.com/LegendApp/legend-list/issues/513), checked at
  3.3.3).
- The values in [`helpers/sortable-metrics.ts`](helpers/sortable-metrics.ts) are estimates until
  they are tuned on a device.
- Vertical, single-column lists only.
