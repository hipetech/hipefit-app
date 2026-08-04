import { StyleSheet } from 'react-native';
import { Host } from '@expo/ui';
import { Button, Image, Menu } from '@expo/ui/swift-ui';
import {
  accessibilityHint,
  accessibilityLabel,
  contentShape,
  frame,
  glassEffect,
  shapes,
} from '@expo/ui/swift-ui/modifiers';

import {
  FLOATING_ACTION_BUTTON_BOTTOM_INSET,
  FLOATING_ACTION_BUTTON_SIZE,
  FLOATING_ACTION_BUTTON_TRAILING_INSET,
} from '@/features/floating-action-button/floating-action-button-metrics';
import { useAppColorScheme } from '@/hooks/use-app-color-scheme';
import { mods } from '@/theme/modifiers';

const styles = StyleSheet.create({
  host: {
    position: 'absolute',
    right: FLOATING_ACTION_BUTTON_TRAILING_INSET,
    bottom: FLOATING_ACTION_BUTTON_BOTTOM_INSET,
    width: FLOATING_ACTION_BUTTON_SIZE,
    height: FLOATING_ACTION_BUTTON_SIZE,
  },
});

/**
 * All four belong on the glyph, not the `Menu`: a `Menu` labels and hit-tests
 * its *label*, so modifiers there reach only the menu container. `frame` grows
 * the label to the full circle and `contentShape` makes that area tappable —
 * `frame` alone does not, and the order matters.
 */
const MENU_LABEL_MODIFIERS = [
  frame({
    width: FLOATING_ACTION_BUTTON_SIZE,
    height: FLOATING_ACTION_BUTTON_SIZE,
  }),
  contentShape(shapes.circle()),
  accessibilityLabel('Create'),
  accessibilityHint('Opens a menu of create actions.'),
];

/**
 * The circle itself. Separate from `MENU_LABEL_MODIFIERS` on purpose —
 * modifiers on the `Menu` reach the container, so they can carry appearance but
 * never hit area or accessibility.
 */
const MENU_MODIFIERS = [
  frame({
    width: FLOATING_ACTION_BUTTON_SIZE,
    height: FLOATING_ACTION_BUTTON_SIZE,
  }),
  glassEffect({
    glass: { variant: 'regular', interactive: true },
    shape: 'circle',
  }),
];

/**
 * The global create button — a floating circle above the tab bar, on every tab.
 *
 * An overlay rather than `NativeTabs.BottomAccessory`, which only ever renders
 * a full-width pill. The cost: it cannot observe the tab bar, so
 * `floating-action-button-metrics.ts` carries measured constants and
 * `app/(private)/_layout.tsx` must pin `minimizeBehavior="never"` or the bar
 * shrinks on scroll and this drifts away from it.
 *
 * No `onPrimaryAction` — a plain SwiftUI `Menu` opens on both tap and long
 * press. Adding it routes tap to a JS callback instead of the menu; don't, and
 * don't add `onTapGesture` / `onLongPressGesture` / `ContextMenu` beside it.
 *
 * The open menu covers this button and drops it from the accessibility tree.
 * That is what an anchored `UIMenu` does on iOS 26 — expected, not a bug.
 *
 * The rules above and the reasoning behind them: `docs/app/navigation.md`.
 */
export const CreateFloatingActionButton = () => {
  const colorScheme = useAppColorScheme();

  return (
    <Host style={styles.host} colorScheme={colorScheme}>
      <Menu
        label={
          <Image systemName="plus" size={24} modifiers={MENU_LABEL_MODIFIERS} />
        }
        modifiers={MENU_MODIFIERS}
      >
        {/*
          Written out, never `.map()`ed — SwiftUI children are declared, not
          generated. Labels follow the data model, not Figma's wording: a
          Workout is the logged entity, a Routine the template.

          Each action is `disabled` until it has a destination. Going live means
          dropping that and adding an `onPress` — a state change, so it also
          earns a `hapticImpact()` from `@/lib/haptics`.
        */}
        <Button
          label="Start Workout"
          systemImage="play.fill"
          modifiers={mods.disabledOnly}
        />
        <Button
          label="New Routine"
          systemImage="list.bullet.rectangle"
          modifiers={mods.disabledOnly}
        />
        <Button
          label="Custom Exercise"
          systemImage="dumbbell"
          modifiers={mods.disabledOnly}
        />
      </Menu>
    </Host>
  );
};
