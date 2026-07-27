import type { FC, ReactNode } from 'react';
import type { ColorValue } from 'react-native';

export interface CardProps {
  children: ReactNode;
  /** Inner padding applied on all edges. @default 16 */
  padding?: number;
  /** Vertical spacing between children. @default 12 */
  spacing?: number;
  /** Corner radius. @default 16 */
  radius?: number;
  /** Surface fill color. @default colors.secondarySystemBackground */
  background?: ColorValue;
  /** Draw a 2px accent border (e.g. the active-workout banner). @default false */
  bordered?: boolean;
  /** Border color used when `bordered` is set. @default colors.brand */
  borderColor?: ColorValue;
  /** Horizontal alignment of children. @default 'leading' */
  alignment?: 'leading' | 'center' | 'trailing';
  /** Fixed width (e.g. horizontally-scrolled routine cards). */
  width?: number;
}

/**
 * Surface container. A Host-less SwiftUI subtree on iOS — compose it inside a
 * screen's `Host`. Android renders a plain RN `View` fallback.
 */
export declare const Card: FC<CardProps>;
