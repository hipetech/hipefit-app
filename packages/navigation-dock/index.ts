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
   * Distance in points from the bottom of the **screen** to the top edge of the
   * tab bar, supplied from `NAVIGATION_DOCK_BOTTOM_INSET`.
   *
   * It does two jobs: the panel is anchored above this line, and the scrim stops
   * at it, so the tab bar and the Create circle stay lit and tappable while the
   * panel is open.
   *
   * Passed in rather than measured because a sibling overlay cannot read the
   * system tab bar's geometry through public API. Do **not** subtract the safe
   * area before sending it: the measured constant already accounts for the
   * floating tab bar being inset within the safe area on iOS 26, and native
   * treats the safe area as a floor rather than adding it.
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
 * The Create action panel and the scrim behind it.
 *
 * It renders no tabs **and no button**. All five items along the bottom — the
 * four tabs and the Create circle — are real `UITabBar` items; Create is a
 * `role="search"` trigger, which is what makes UIKit draw it detached beside the
 * bar. This view is the panel that trigger opens.
 *
 * `ViewProps` is intersected in rather than folded into
 * `NavigationDockViewProps`: that interface is the frozen bridge contract
 * (`docs/plans/native-navigation-dock/reference/bridge-contract.md`) and adding
 * `style` to it would make the contract and the component's accepted props two
 * different things. The caller still needs `style` — the panel's horizontal
 * margins and its top limit come from `safeAreaLayoutGuide`, and UIKit shrinks
 * a subview's safe-area insets by however much its frame is inset from the
 * window, so this must be mounted edge to edge (`StyleSheet.absoluteFill`).
 */
export const NavigationDockView = requireNativeView<
  NavigationDockViewProps & ViewProps
>('HipefitNavigationDock');
