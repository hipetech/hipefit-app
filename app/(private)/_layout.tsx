import { StyleSheet, View } from 'react-native';
import { NativeTabs } from 'expo-router/unstable-native-tabs';

import { CreateFloatingActionButton } from '@/features/floating-action-button/create-floating-action-button';

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
});

/**
 * Bottom tab navigation, plus the app-wide create affordance.
 *
 * The create button is a floating circle overlaid above the tab bar, so it
 * appears on every tab from one declaration instead of a `+` per screen. It is
 * a sibling of `NativeTabs`, not a child — hence the wrapping `View`, which
 * gives both the navigator and the overlay a deterministic flex parent.
 *
 * `minimizeBehavior="never"` is **required, not cosmetic**. The overlay cannot
 * observe the tab bar (there is no API for its height or its minimize state —
 * see `features/floating-action-button/floating-action-button-metrics.ts`), so if the bar were allowed to shrink
 * on scroll the button would stay at its fixed offset and drift away from it.
 * Pinning the bar is the price of a circle; `NativeTabs.BottomAccessory` is the
 * variant that gets the iOS 26 minimize behaviour for free, at the cost of
 * being a full-width pill.
 */
export default function TabsLayout() {
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
      </NativeTabs>

      <CreateFloatingActionButton />
    </View>
  );
}
