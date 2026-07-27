import type { TextStyle } from 'react-native';
import * as React from 'react';
import { Text as RNText } from 'react-native';

import { colors } from '@/theme/colors';

const baseStyle: TextStyle = {
  color: colors.label,
};

/**
 * Apple's 11 text styles, 1:1. The names match the `textStyle` union of
 * `@expo/ui/swift-ui`'s `font()` modifier, so an RN `Text` and a SwiftUI `Text`
 * inside a `Host` are described with one vocabulary.
 *
 * The numbers are the metrics at the *default* Dynamic Type size (Large). RN
 * multiplies `fontSize` — and, on iOS, `lineHeight` with it
 * (`RCTTextAttributes.mm:141`) — by the user's Dynamic Type multiplier whenever
 * `allowFontScaling` is true, which is the default. Never set
 * `allowFontScaling={false}`: that opts the app out of accessibility text
 * sizing.
 *
 * Typography only. No variant sets `textAlign`, `margin*`, `padding*` or
 * borders — that is layout, and belongs at the call site via `style`. Colour
 * beyond the `label` base (e.g. `colors.secondaryLabel` for secondary text)
 * likewise comes from the call site.
 */
const variantStyles = {
  largeTitle: { fontSize: 34, lineHeight: 41, fontWeight: '400' },
  title: { fontSize: 28, lineHeight: 34, fontWeight: '400' },
  title2: { fontSize: 22, lineHeight: 28, fontWeight: '400' },
  title3: { fontSize: 20, lineHeight: 25, fontWeight: '400' },
  headline: { fontSize: 17, lineHeight: 22, fontWeight: '600' },
  body: { fontSize: 17, lineHeight: 22, fontWeight: '400' },
  callout: { fontSize: 16, lineHeight: 21, fontWeight: '400' },
  subheadline: { fontSize: 15, lineHeight: 20, fontWeight: '400' },
  footnote: { fontSize: 13, lineHeight: 18, fontWeight: '400' },
  caption: { fontSize: 12, lineHeight: 16, fontWeight: '400' },
  caption2: { fontSize: 11, lineHeight: 13, fontWeight: '400' },
} as const satisfies Record<string, TextStyle>;

type TextVariant = keyof typeof variantStyles;

/**
 * The iOS Dynamic Type *ramp* each variant scales along.
 *
 * Without this, RN falls back to a single flat `fontSizeMultiplier` applied
 * uniformly to every size. Apple's ramps are not uniform — at accessibility
 * sizes `body` grows proportionally much more than `largeTitle` does — so a
 * flat multiplier over-scales the big styles and under-scales the small ones.
 * Passing the ramp makes RN resolve the multiplier through `UIFontMetrics` for
 * that specific style instead (`RCTTextAttributes.mm:244-248`), which is the
 * same curve SwiftUI's `font({ textStyle })` follows. That keeps RN text and
 * SwiftUI text in a `Host` scaling together rather than drifting apart.
 *
 * Keeping an explicit `fontSize` alongside the ramp is intentional: RN uses it
 * as the base for `-scaledValueForValue:` and notes it "reduces rounding
 * errors" (`:246-247`) versus letting the ramp supply its own base size.
 *
 * UIKit's names differ from SwiftUI's for two entries — `title1`/`caption1`
 * here are SwiftUI's `title`/`caption`.
 */
const variantRamp: Record<
  TextVariant,
  NonNullable<React.ComponentProps<typeof RNText>['dynamicTypeRamp']>
> = {
  largeTitle: 'largeTitle',
  title: 'title1',
  title2: 'title2',
  title3: 'title3',
  headline: 'headline',
  body: 'body',
  callout: 'callout',
  subheadline: 'subheadline',
  footnote: 'footnote',
  caption: 'caption1',
  caption2: 'caption2',
};

/**
 * App text primitive. Plain RN `Text` coloured from `@/theme/colors` semantic
 * tokens and sized by an Apple `variant`. Usable anywhere in the RN tree;
 * inside an `@expo/ui` swift-ui `Host` use swift-ui `Text` instead.
 */
function Text({
  style,
  variant = 'body',
  ...props
}: React.ComponentProps<typeof RNText> &
  React.RefAttributes<RNText> & {
    variant?: TextVariant;
  }) {
  return (
    <RNText
      style={[baseStyle, variantStyles[variant], style]}
      dynamicTypeRamp={variantRamp[variant]}
      {...props}
    />
  );
}

export { Text };
export type { TextVariant };
