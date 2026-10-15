# `@hipefit/expandable-accessory`

Compound Expo Router integration for content that starts in a native tab accessory and expands into
a Stack route, presented full screen with Apple Zoom or as a page sheet.

## Package layout

```text
expandable-accessory/
├── components/   compound slots, outlets, provider, trigger, zoom source
├── helpers/      pure route-path normalization and the expanded route's screen options
├── hooks/        public context hook
├── context.ts    package context only
├── types.ts      public and internal contracts
└── index.ts      public compound API and type exports
```

Consumers import only from `@hipefit/expandable-accessory`; subdirectory paths are internal.

## Register content

The provider must sit above both the tab navigator and expanded route. Slot components must be direct
children of the provider.

```tsx
<ExpandableAccessory.Provider
  active={hasActiveAccessory}
  href="/accessory-detail"
  presentation="pageSheet"
  expandedPath="/accessory-detail"
  fallbackHref="/"
>
  <ExpandableAccessory.AccessoryContent>
    <CompactAccessory />
  </ExpandableAccessory.AccessoryContent>

  <ExpandableAccessory.ExpandedContent>
    <ExpandedAccessory />
  </ExpandableAccessory.ExpandedContent>

  <Stack />
</ExpandableAccessory.Provider>
```

`href` is the typed navigation destination. `expandedPath` is the absolute path reported by
`usePathname()` after Expo Router resolves groups, relative paths, and parameters. `fallbackHref` is
used when expanded content was opened directly and has no history entry to dismiss into.

`active` is controlled domain state. Turning it off closes the expanded route if it is open. The
consumer must also use it to remove the native accessory wrapper, not only its outlet:

## Mount outlets

The compact outlet must remain a direct child of Expo Router's native accessory:

```tsx
{
  isActive ? (
    <NativeTabs.BottomAccessory>
      <ExpandableAccessory.AccessoryOutlet />
    </NativeTabs.BottomAccessory>
  ) : null;
}
```

The configured Stack route renders the other outlet:

```tsx
export default function AccessoryDetailRoute() {
  return <ExpandableAccessory.ExpandedOutlet />;
}
```

Register that route with the options for the provider's `presentation`. The package cannot set a
Stack screen's presentation itself, so both places must name the same value:

```tsx
<Stack.Screen
  name="accessory-detail"
  options={expandedScreenOptions('pageSheet')}
/>
```

## Choose a presentation

| `presentation` | Screen options                        | Opening from `Trigger`        | Dismissal                                                              |
| -------------- | ------------------------------------- | ----------------------------- | ---------------------------------------------------------------------- |
| `fullScreen`   | `{ presentation: 'fullScreenModal' }` | Zooms out of `ZoomSource`     | Swipe down after a zoom; otherwise only a control that calls `close()` |
| `pageSheet`    | `{ presentation: 'modal' }`           | Slides up as a sheet, no zoom | The sheet's swipe down                                                 |

Apple Zoom does not support sheets, so with `pageSheet` the `ZoomSource` wrapper renders its child
unchanged and the same accessory markup works for both. A full-screen modal has a dismissal gesture
only when Apple Zoom presented it. Opened by `open()`, which carries no zoom source, it can be closed
only by a control, so expanded content presented full screen should offer one that calls `close()`.
Read `presentation` from `useExpandableAccessory()` to show that control only when it is needed.

Every dismissal pops the route and leaves `active` as it was, so the accessory returns with the same
content.

## Mark the zoom source

Wrap one native tap target in `Trigger`, then mark only its visual content as `ZoomSource`. Keeping
the `Pressable` outside the zoom-source wrapper preserves its accessibility element. Independent
controls remain siblings so their taps do not navigate.

```tsx
<ExpandableAccessory.Trigger>
  <Pressable collapsable={false} accessibilityRole="button">
    <ExpandableAccessory.ZoomSource>
      <View collapsable={false}>{/* summary */}</View>
    </ExpandableAccessory.ZoomSource>
  </Pressable>
</ExpandableAccessory.Trigger>
```

`useExpandableAccessory()` exposes `isActive`, route-derived `isExpanded`, `presentation`, `open()`,
and `close()`.
Use `Trigger` plus `ZoomSource` instead of `open()` for taps on the accessory because only that pair
carries an Apple Zoom source.

## Open from elsewhere

`open()` does not check `active`, so code outside the accessory can activate the domain state and
open the route in the same handler. If `active` is still false when the route renders, the provider
closes it.
