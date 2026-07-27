import { Platform } from 'react-native';
import * as Haptics from 'expo-haptics';

/**
 * Intent-named haptics.
 *
 * Call sites say *what happened* (`hapticSuccess`), not which generator to
 * spin up (`notificationAsync(NotificationFeedbackType.Success)`), so the same
 * kind of event feels the same everywhere in the app and the mapping can be
 * retuned in one place.
 *
 * There is no SwiftUI `sensoryFeedback` modifier in `@expo/ui` (checked
 * against `@expo/ui/build/swift-ui/modifiers/index.d.ts` at 57.0.7 — the export
 * list has `symbolEffect` and `animation`, nothing haptic), so feedback has to
 * be fired from JS inside the existing event callbacks.
 */

/**
 * iOS only. On Android `expo-haptics` falls back to the `Vibrator` API, which
 * is a coarser, buzzier sensation than the Taptic Engine and needs the
 * `VIBRATE` permission; Android would want `performAndroidHapticsAsync` with
 * its own vocabulary. Until that is designed, Android simply gets nothing.
 */
const isSupported = Platform.OS === 'ios';

/**
 * Fire-and-forget. Every `expo-haptics` call is async, and a rejection (no
 * Taptic Engine, Low Power Mode, simulator) must not surface as an unhandled
 * rejection or bubble into the interaction the haptic is decorating. Nothing
 * here is ever awaited: the feedback accompanies the state change, it does not
 * gate it.
 */
const fire = (trigger: () => Promise<void>) => {
  if (!isSupported) {
    return;
  }
  trigger().catch(() => {
    // A haptic that fails is a haptic that did not play. That is all.
  });
};

/**
 * The value moved within a set of choices — a filter option, a segment, a row
 * opening or closing. The lightest tick there is, which is what makes it safe
 * for events the user can repeat quickly.
 */
export const hapticSelection = () => fire(Haptics.selectionAsync);

/**
 * A tap that puts something new on screen — presenting a sheet, committing to
 * a destination. `Light`, because these are small UI elements, not a drawer
 * slamming home.
 */
export const hapticImpact = () =>
  fire(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light));

/**
 * An operation the user committed to actually completed — a write that landed.
 * Only on genuine success; the failure path stays silent, since a failure the
 * user must read about is announced by the UI, not by the Taptic Engine.
 */
export const hapticSuccess = () =>
  fire(() =>
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
  );
