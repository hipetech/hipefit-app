import { StyleSheet, View } from 'react-native';
import { NativeTabs } from 'expo-router/unstable-native-tabs';

import { NavigationDock } from '@/features/navigation-dock/navigation-dock';
import { hapticImpact } from '@/lib/haptics';
import { useNavigationDockStore } from '@/stores/use-navigation-dock-store';

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
});

/**
 * Bottom tab navigation, plus the app-wide create affordance.
 *
 * The four tabs are the real `UITabBar`. `NativeTabs` renders and owns them
 * outright — selection, per-tab history, repeated-selection behaviour, deep
 * links and state restoration are UIKit's, and on iOS 26 the bar already draws
 * itself as the floating glass capsule the design asks for.
 *
 * **Create is the fifth trigger, not an overlay.** `role="search"` is the whole
 * trick: on iOS 26 UIKit draws a search-role item as a *detached circle beside*
 * the tab bar capsule, shrinking the capsule to make room. That is exactly the
 * reference layout, and it is unreachable any other way — a `UITabBar` spreads
 * its items across the full width, so a circle drawn beside it by an overlay
 * lands on top of the last item.
 *
 * Three things make a search tab behave as a button rather than as a tab:
 *
 * - `disabled` prevents the native selection, so tapping navigates nowhere. The
 *   press still arrives as `tabPress` with `isPrevented: true`, which is what
 *   opens the panel.
 * - The explicit `Icon` and `Label` override the system magnifying glass and
 *   title, so it presents and announces as Create, never as Search.
 * - Because it is detached, UIKit reports it outside the group holding the four
 *   tabs. Verified in the accessibility tree: `[tab-bar]` contains the capsule
 *   of four `[button]`s and, as its sibling, a separate `"Create"` group. It is
 *   never one of the four and never carries `[selected]`.
 *
 * **The pre-iOS-26 cost.** The detached circle is an iOS 26 rendering. On
 * 16.4–25 a search-role item is an ordinary fifth item *inside* the bar: still
 * labelled Create, still opening the panel, but sharing the bar's width rather
 * than sitting beside it. Unverified — no pre-26 runtime is installed. This is
 * the trade for the reference layout on current systems.
 *
 * `minimizeBehavior="never"` is **required, not cosmetic**. The panel is a
 * sibling overlay that cannot observe the tab bar (there is no API for its
 * height or its minimize state — see
 * `features/navigation-dock/navigation-dock-metrics.ts`), so a bar that shrank
 * on scroll would leave the panel anchored to a position the bar no longer
 * occupies.
 */
export default function TabsLayout() {
  const expanded = useNavigationDockStore((state) => state.expanded);
  const toggle = useNavigationDockStore((state) => state.toggle);

  /*
   * The haptic fires on the way open only. `hapticImpact` is documented as "a
   * tap that puts something new on screen", which the panel arriving is and the
   * panel leaving is not — iOS taps when a sheet presents and stays silent when
   * it dismisses. Firing on both would also leave the button inconsistent with
   * the scrim and the escape gesture, neither of which routes through here.
   */
  const handleCreatePress = () => {
    if (!expanded) {
      hapticImpact();
    }
    toggle();
  };

  return (
    <View style={styles.root}>
      <NativeTabs minimizeBehavior="never">
        <NativeTabs.Trigger name="(home)">
          <NativeTabs.Trigger.Icon
            sf={{ default: 'house', selected: 'house.fill' }}
            md="home"
          />
          <NativeTabs.Trigger.Label>Home</NativeTabs.Trigger.Label>
        </NativeTabs.Trigger>

        <NativeTabs.Trigger name="workouts">
          <NativeTabs.Trigger.Icon
            sf={{ default: 'dumbbell', selected: 'dumbbell.fill' }}
            md="fitness_center"
          />
          <NativeTabs.Trigger.Label>Workouts</NativeTabs.Trigger.Label>
        </NativeTabs.Trigger>

        <NativeTabs.Trigger name="exercises">
          <NativeTabs.Trigger.Icon sf="checklist" md="checklist" />
          <NativeTabs.Trigger.Label>Exercises</NativeTabs.Trigger.Label>
        </NativeTabs.Trigger>

        <NativeTabs.Trigger name="settings">
          <NativeTabs.Trigger.Icon
            sf={{ default: 'gearshape', selected: 'gearshape.fill' }}
            md="settings"
          />
          <NativeTabs.Trigger.Label>Settings</NativeTabs.Trigger.Label>
        </NativeTabs.Trigger>

        <NativeTabs.Trigger
          name="create"
          role="search"
          disabled
          accessibilityLabel={expanded ? 'Close' : 'Create'}
          listeners={{ tabPress: handleCreatePress }}
        >
          {/*
            The glyph is the open/closed indicator, the way the overlay button's
            cross-fade used to be. A tab bar item cannot animate between two
            images, so this swaps rather than cross-fades — the one piece of
            motion given up by moving the button into the bar.
          */}
          <NativeTabs.Trigger.Icon
            sf={expanded ? 'xmark' : 'plus'}
            md={expanded ? 'close' : 'add'}
          />
          <NativeTabs.Trigger.Label>
            {expanded ? 'Close' : 'Create'}
          </NativeTabs.Trigger.Label>
        </NativeTabs.Trigger>
      </NativeTabs>

      <NavigationDock />
    </View>
  );
}
