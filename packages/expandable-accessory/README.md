# `@hipefit/expandable-accessory`

Compound Expo Router integration for content that starts in a native tab accessory and expands into
a Stack route with Apple Zoom.

## Package layout

```text
expandable-accessory/
├── components/   compound slots, outlets, provider, trigger, zoom source
├── helpers/      pure route-path normalization
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

Register that route with `presentation: 'fullScreenModal'`. Apple Zoom does not support form sheets
or popovers.

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

`useExpandableAccessory()` exposes `isActive`, route-derived `isExpanded`, `open()`, and `close()`.
Use `Trigger` plus `ZoomSource` instead of `open()` for normal taps because only that pair carries an
Apple Zoom source.
