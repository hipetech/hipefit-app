import type { ViewProps } from 'react-native';
import { requireNativeView } from 'expo';

/** One item in the expanded action grid. */
export interface NavigationDockAction {
  id: string;
  label: string;
  systemImage: string;
  enabled: boolean;
}

export interface NavigationDockViewProps {
  expanded: boolean;
  /** At most nine. Native renders three per row in descriptor order. */
  actions: NavigationDockAction[];
  /**
   * Points from the bottom of the **screen** to the top edge of the tab bar,
   * from `NAVIGATION_DOCK_BOTTOM_INSET`. Anchors the panel and stops the scrim,
   * so the tab bar stays lit while the panel is open.
   *
   * Passed in because a sibling overlay cannot read the tab bar's geometry
   * through public API. Do **not** subtract the safe area first — the constant
   * already accounts for the bar being inset within it on iOS 26, and native
   * treats the safe area as a floor rather than an addend.
   */
  bottomInset: number;
  reduceMotion: boolean;
  /** `null` follows the device. Applied as `overrideUserInterfaceStyle`. */
  colorScheme: 'light' | 'dark' | null;
  onDismissRequest: (event: {
    nativeEvent: { reason: 'backdrop' | 'escape' };
  }) => void;
  onActionPress: (event: { nativeEvent: { id: string } }) => void;
}

/**
 * The Create action panel and the scrim behind it. It renders no tabs and no
 * button — all five bottom items are real `UITabBar` items, Create being a
 * `role="search"` trigger UIKit draws detached beside the bar.
 *
 * `ViewProps` is intersected in rather than folded into
 * `NavigationDockViewProps`, which is the frozen bridge contract
 * (`docs/plans/native-navigation-dock/reference/bridge-contract.md`). The caller
 * still needs `style`: UIKit shrinks a subview's safe-area insets by however
 * much its frame is inset from the window, so this must be mounted edge to edge
 * (`StyleSheet.absoluteFill`).
 */
export const NavigationDockView = requireNativeView<
  NavigationDockViewProps & ViewProps
>('HipefitNavigationDock');
