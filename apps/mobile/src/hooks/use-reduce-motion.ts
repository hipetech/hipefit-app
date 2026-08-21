import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';

/**
 * Tracks the system "Reduce Motion" accessibility setting.
 *
 * SwiftUI does **not** disable explicit animations for you: `.animation(_:value:)`
 * runs whatever it is handed, and `@expo/ui`'s `animation` modifier is a thin
 * pass-through to it (`AnimationModifier` in
 * `node_modules/@expo/ui/ios/Modifiers/ViewModifierRegistry.swift` calls
 * `content.animation(_:value:)` with no accessibility check). Honouring the
 * setting is therefore the caller's job — Apple's own guidance is to read
 * `@Environment(\.accessibilityReduceMotion)` and skip the animation. There is
 * no way to read that environment value from JS, so we read the same underlying
 * `UIAccessibility.isReduceMotionEnabled` flag through React Native and drop the
 * animating modifiers from the array instead.
 *
 * The query is async, so this reports `false` (motion allowed) for the frame or
 * two before it resolves. That is harmless for the counters that use it:
 * `.animation(_:value:)` does not animate when it is first applied — it only
 * fires on *subsequent* changes to its value — and the real setting has landed
 * long before a Firestore snapshot moves one of those numbers. The listener
 * keeps the value live if the setting is toggled while the app is running.
 */
export const useReduceMotion = (): boolean => {
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    let active = true;

    AccessibilityInfo.isReduceMotionEnabled().then((enabled) => {
      if (active) {
        setReduceMotion(enabled);
      }
    });

    const subscription = AccessibilityInfo.addEventListener(
      'reduceMotionChanged',
      setReduceMotion
    );

    return () => {
      active = false;
      subscription.remove();
    };
  }, []);

  return reduceMotion;
};
