import type { ReactNode } from 'react';
import type { ColorValue } from 'react-native';
import { VStack } from '@expo/ui/swift-ui';
import {
  background,
  cornerRadius,
  frame,
  padding,
  strokeBorder,
} from '@expo/ui/swift-ui/modifiers';

import { colors } from '@/theme/colors';

export interface CardProps {
  children: ReactNode;
  /** Inner padding applied on all edges. @default 16 */
  padding?: number;
  /** Vertical spacing between children. @default 12 */
  spacing?: number;
  /**
   * Corner radius. 12pt is the Apple value for a free-floating content card
   * (the App Store carousel idiom these cards use) — not the 10pt an
   * `insetGrouped` `List` draws for its own section background, which no `Card`
   * is a part of.
   * @default 12
   */
  radius?: number;
  /**
   * Surface fill color. Defaults to the grouped row surface, which is the
   * correct card fill on a `systemGroupedBackground` page.
   * @default colors.secondarySystemGroupedBackground
   */
  background?: ColorValue;
  /** Draw a hairline border (e.g. the active-workout banner). @default false */
  bordered?: boolean;
  /** Border color used when `bordered` is set. @default colors.separator */
  borderColor?: ColorValue;
  /** Horizontal alignment of children. @default 'leading' */
  alignment?: 'leading' | 'center' | 'trailing';
  /**
   * Fixed **outer** width, padding included (e.g. horizontally-scrolled routine
   * cards) — i.e. border-box semantics, where the painted card is exactly
   * `width` wide and the padding eats into it.
   */
  width?: number;
}

/**
 * Surface container (SwiftUI). Host-less — compose inside a screen's `Host`.
 *
 * Modifier order is load-bearing. `@expo/ui` applies the array with a `reduce`
 * (`View+ModifierArray.swift`), so index 0 is the **innermost** modifier and the
 * last entry is the outermost — exactly like writing the chain by hand in Swift:
 *
 *   VStack.padding(p).frame(width:, alignment:).background(c).cornerRadius(r)
 *
 * `frame` must sit **after** `padding` and **before** `background`:
 *
 * - After `padding`, because `width` is the card's *outer* width (border-box
 *   semantics). Putting `frame` first would size the content box, making the
 *   painted card `width + 2 * padding`.
 * - Before `background`, because `.background` reports the *primary content*
 *   size. A `VStack` does not stretch to fill a proposed width — it hugs its
 *   widest child — so with `frame` on the outside the fill was painted at the
 *   hugged width and merely centered inside the `width` slot. That is what made
 *   fixed-width routine cards render at visibly uneven widths.
 *
 * When no `width` is passed no `frame` is emitted at all, so the chain is
 * byte-for-byte the previous one and auto-width cards are unaffected.
 */
export const Card = ({
  children,
  padding: paddingValue = 16,
  spacing = 12,
  radius = 12,
  background: backgroundColor = colors.secondarySystemGroupedBackground,
  bordered = false,
  borderColor = colors.separator,
  alignment = 'leading',
  width,
}: CardProps) => {
  const modifiers = [
    padding({ all: paddingValue }),
    // Impose the outer width before anything paints, keeping the content on the
    // same edge the children are aligned to.
    ...(width != null ? [frame({ width, alignment })] : []),
    background(backgroundColor),
    cornerRadius(radius),
    ...(bordered
      ? [
          strokeBorder({
            color: borderColor,
            style: { lineWidth: 1 },
            shape: 'roundedRectangle' as const,
            cornerRadius: radius,
          }),
        ]
      : []),
  ];

  return (
    <VStack spacing={spacing} alignment={alignment} modifiers={modifiers}>
      {children}
    </VStack>
  );
};
