import { Platform } from 'react-native';
import { Color } from 'expo-router';

/**
 * Semantic color tokens for the app.
 *
 * On iOS these resolve to UIKit semantic colors (`Color.ios.*`) and on Android
 * to Material 3 dynamic colors (`Color.android.dynamic.*`) — both auto-adapt to
 * light/dark mode on-device. The `default` hex is the web/SSR fallback only.
 *
 * The app is dark-first (purple/lavender brand, hue 290), so the web fallbacks
 * for surfaces/labels use the dark palette ported from the old `global.css`.
 *
 * Note (Android + React Compiler): call `useColorScheme()` inside any component
 * that renders these so it re-renders when the system theme flips.
 */
export const colors = {
  /** Primary text. */
  label: Platform.select({
    ios: Color.ios.label,
    android: Color.android.dynamic.onSurface,
    default: '#ffffff',
  })!,
  /** Secondary / supporting text. */
  secondaryLabel: Platform.select({
    ios: Color.ios.secondaryLabel,
    android: Color.android.dynamic.onSurfaceVariant,
    default: 'rgba(235, 235, 245, 0.6)',
  })!,
  /** Tertiary / muted text (placeholders, captions). */
  tertiaryLabel: Platform.select({
    ios: Color.ios.tertiaryLabel,
    android: Color.android.dynamic.outline,
    default: 'rgba(235, 235, 245, 0.3)',
  })!,
  /** Hairline divider color. */
  separator: Platform.select({
    ios: Color.ios.separator,
    android: Color.android.dynamic.outlineVariant,
    // oklch(0.38 0.012 290) — dark separator from global.css
    default: '#424148',
  })!,
  /** App background. */
  systemBackground: Platform.select({
    ios: Color.ios.systemBackground,
    android: Color.android.dynamic.surface,
    // oklch(0.13 0.02 290) — dark background from global.css
    default: '#07060f',
  })!,
  /** Raised surface (cards, rows). */
  secondarySystemBackground: Platform.select({
    ios: Color.ios.secondarySystemBackground,
    android: Color.android.dynamic.surfaceContainer,
    // oklch(0.20 0.018 290) — dark surface from global.css
    default: '#16151e',
  })!,
  /** Further raised surface (nested / secondary surfaces). */
  tertiarySystemBackground: Platform.select({
    ios: Color.ios.tertiarySystemBackground,
    android: Color.android.dynamic.surfaceContainerHigh,
    // oklch(0.25 0.015 290) — dark surface-secondary from global.css
    default: '#212028',
  })!,
  /** Destructive / error. */
  systemRed: Platform.select({
    ios: Color.ios.systemRed,
    android: Color.android.dynamic.error,
    default: '#ff453a',
  })!,
  /**
   * Brand accent (purple/lavender, hue 290).
   *
   * Converted from the old `global.css` oklch brand tokens (OKLCH → sRGB):
   *   light `oklch(0.66 0.165 290)` → #937DEF
   *   dark  `oklch(0.72 0.155 290)` → #A491FE
   * We use the light value as the single representative brand literal; SwiftUI's
   * seed-color / vibrancy handling adapts it well enough across appearances.
   */
  brand: '#937DEF',
  /** Foreground/content color on top of `brand` (was `--accent-foreground: white`). */
  brandForeground: '#ffffff',
} as const;

/**
 * The brand seed color, for use as `Host.seedColor`. Drives SwiftUI's derived
 * tints/accents across the app. Same value as `colors.brand`.
 */
export const BRAND_SEED = colors.brand;
