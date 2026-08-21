# `@hipefit/navigation-dock`

Private, iOS-only Expo view module for Hipefit's native Create action panel.

The package renders the expandable action card and its invisible modal backdrop. It does not render
the tab bar or the Create trigger. Those remain real `UITabBar` items owned by Expo Router in
`apps/mobile/app/(private)/_layout.tsx`.

## Requirements

- iOS 16.4 or later
- Expo development build; this native module is not available in Expo Go
- An edge-to-edge React Native parent

On iOS 26 and later, the card uses the system glass effect. Earlier supported versions use a regular
material fallback.

## Usage

The app consumes this package through the root Bun workspace:

```json
{
  "dependencies": {
    "@hipefit/navigation-dock": "workspace:*"
  }
}
```

Mount the view edge to edge. Insetting its frame changes the safe-area values UIKit gives the view
and places the panel at the wrong vertical offset.

```tsx
import { StyleSheet } from 'react-native';
import { NavigationDockView } from '@hipefit/navigation-dock';

const styles = StyleSheet.create({
  dock: StyleSheet.absoluteFill,
});

<NavigationDockView
  style={styles.dock}
  expanded={expanded}
  actions={actions}
  bottomInset={bottomInset}
  reduceMotion={reduceMotion}
  colorScheme={colorScheme}
  onDismissRequest={handleDismissRequest}
  onActionPress={handleActionPress}
/>;
```

The production adapter is `apps/mobile/src/features/navigation-dock/navigation-dock.tsx`.

## API

### `NavigationDockAction`

| Field         | Type      | Description                                                    |
| ------------- | --------- | -------------------------------------------------------------- |
| `id`          | `string`  | Semantic identifier returned by `onActionPress`.               |
| `label`       | `string`  | Visible and accessible action label.                           |
| `systemImage` | `string`  | SF Symbol name. Invalid names render a question-mark fallback. |
| `enabled`     | `boolean` | Whether the action can emit `onActionPress`.                   |

Native renders actions in descriptor order, three per row, and ignores entries after the ninth.
Disabled actions remain visible and consume touches without emitting an event.

### `NavigationDockView`

`NavigationDockView` accepts React Native `ViewProps` plus the following props:

| Prop               | Type                        | Description                                                      |
| ------------------ | --------------------------- | ---------------------------------------------------------------- |
| `expanded`         | `boolean`                   | React-owned presentation state.                                  |
| `actions`          | `NavigationDockAction[]`    | Action descriptors in reading order.                             |
| `bottomInset`      | `number`                    | Points from the screen bottom to the tab bar's top edge.         |
| `reduceMotion`     | `boolean`                   | Selects the shorter reduced-motion fade.                         |
| `colorScheme`      | `'light' \| 'dark' \| null` | Overrides the native interface style; `null` follows the device. |
| `onDismissRequest` | `(event) => void`           | Requests dismissal with reason `backdrop` or `escape`.           |
| `onActionPress`    | `(event) => void`           | Reports the semantic `id` of an enabled action.                  |

Event payloads have these shapes:

```ts
type DismissRequestEvent = {
  nativeEvent: { reason: 'backdrop' | 'escape' };
};

type ActionPressEvent = {
  nativeEvent: { id: string };
};
```

### `bottomInset`

`bottomInset` is the distance from the bottom of the screen to the top edge of the tab bar. A sibling
overlay cannot read the system tab bar's geometry through public APIs, so the React adapter must
supply this value.

Do not subtract or add the bottom safe-area inset. Native treats the safe area as a minimum floor,
and an iOS 26 floating tab bar is already inset within it. Hipefit's measured value lives in
`apps/mobile/src/features/navigation-dock/navigation-dock-metrics.ts` and must be remeasured when
its documented conditions change.

## State And Events

The bridge is declarative: props go in and events come out. It intentionally exposes no native
functions.

- React owns `expanded`, action descriptors, and action routing.
- Native owns rendering, hit testing, animation, materials, and accessibility.
- Native never changes `expanded`; dismiss interactions only emit `onDismissRequest`.
- While collapsed, the full-screen view passes touches through.
- While expanded, the invisible backdrop blocks the screen and emits a backdrop dismissal request.
- The VoiceOver escape gesture emits an escape dismissal request.

## Native Structure

| File                                    | Responsibility                                                 |
| --------------------------------------- | -------------------------------------------------------------- |
| `index.ts`                              | TypeScript types and `requireNativeView` binding.              |
| `expo-module.config.json`               | Apple-only Expo module registration.                           |
| `ios/HipefitNavigationDockModule.swift` | Props, events, and atomic prop application.                    |
| `ios/NavigationDockView.swift`          | UIKit view, layout, hit testing, animation, and accessibility. |
| `ios/NavigationDockDescriptors.swift`   | Bridge records and native value types.                         |
| `ios/DockActionControl.swift`           | Accessible action-grid control.                                |
| `ios/DockGlassSurface.swift`            | SwiftUI glass surface and pre-iOS-26 material fallback.        |
| `ios/DockLayout.swift`                  | Layout, typography, symbol, and motion constants.              |
| `ios/HipefitNavigationDock.podspec`     | CocoaPods target definition.                                   |

## Development

Run commands from the repository root:

```bash
bun install
bun run ios:development
```

After adding or removing a native dependency, update CocoaPods and commit the resulting lockfile:

```bash
cd apps/mobile/ios
pod install
```

Changes to Swift require rebuilding the development client. TypeScript-only changes can use the
normal Metro refresh cycle.

Validate TypeScript and lint from the repository root:

```bash
bun run type-check
bun run lint
```
