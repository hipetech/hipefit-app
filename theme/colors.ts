import { Platform } from 'react-native';
import { Color } from 'expo-router';

/**
 * Semantic color tokens for the app.
 *
 * These resolve to UIKit semantic colors (`Color.ios.*`), which auto-adapt to
 * light/dark mode and accessibility settings on-device. The `default` hex is
 * the web/SSR fallback only — the app is iOS-only, so `Platform.select` is kept
 * purely to supply that fallback, and there is no Android branch.
 *
 * There is deliberately no brand color. The app adopts the platform's own accent
 * so it reads as a native Apple app: an unset `Host.seedColor` makes SwiftUI use
 * the system accent, which is what we want. Use `accent` only where an explicit
 * color *value* is unavoidable (RN tint props) — never to pin a `seedColor`.
 */
export const colors = {
  /** Primary text. */
  label: Platform.select({
    ios: Color.ios.label,
    default: '#000000',
  })!,
  /** Secondary / supporting text. */
  secondaryLabel: Platform.select({
    ios: Color.ios.secondaryLabel,
    default: 'rgba(60, 60, 67, 0.6)',
  })!,
  /** Tertiary / muted text (placeholders, captions). */
  tertiaryLabel: Platform.select({
    ios: Color.ios.tertiaryLabel,
    default: 'rgba(60, 60, 67, 0.3)',
  })!,
  /** Quaternary text — the faintest readable tier. */
  quaternaryLabel: Platform.select({
    ios: Color.ios.quaternaryLabel,
    default: 'rgba(60, 60, 67, 0.18)',
  })!,
  /** Placeholder text inside inputs. */
  placeholderText: Platform.select({
    ios: Color.ios.placeholderText,
    default: 'rgba(60, 60, 67, 0.3)',
  })!,

  /** Hairline divider color. */
  separator: Platform.select({
    ios: Color.ios.separator,
    default: 'rgba(60, 60, 67, 0.29)',
  })!,
  /** Opaque divider, for use where translucency would bleed. */
  opaqueSeparator: Platform.select({
    ios: Color.ios.opaqueSeparator,
    default: '#c6c6c8',
  })!,

  /** App background (ungrouped screens). */
  systemBackground: Platform.select({
    ios: Color.ios.systemBackground,
    default: '#ffffff',
  })!,
  /** Raised surface on an ungrouped background. */
  secondarySystemBackground: Platform.select({
    ios: Color.ios.secondarySystemBackground,
    default: '#f2f2f7',
  })!,
  /** Further raised surface on an ungrouped background. */
  tertiarySystemBackground: Platform.select({
    ios: Color.ios.tertiarySystemBackground,
    default: '#ffffff',
  })!,

  /**
   * Page background for grouped-list screens. This — not
   * `systemBackground` — is the correct backdrop behind `insetGrouped` rows.
   */
  systemGroupedBackground: Platform.select({
    ios: Color.ios.systemGroupedBackground,
    default: '#f2f2f7',
  })!,
  /** Row/card surface on a grouped background. */
  secondarySystemGroupedBackground: Platform.select({
    ios: Color.ios.secondarySystemGroupedBackground,
    default: '#ffffff',
  })!,
  /** Nested surface on a grouped background. */
  tertiarySystemGroupedBackground: Platform.select({
    ios: Color.ios.tertiarySystemGroupedBackground,
    default: '#f2f2f7',
  })!,

  /** Fill for controls sitting on a background — e.g. an avatar placeholder. */
  systemFill: Platform.select({
    ios: Color.ios.systemFill,
    default: 'rgba(120, 120, 128, 0.2)',
  })!,
  /** Secondary control fill. */
  secondarySystemFill: Platform.select({
    ios: Color.ios.secondarySystemFill,
    default: 'rgba(120, 120, 128, 0.16)',
  })!,
  /** Tertiary control fill — track colors, inactive segments. */
  tertiarySystemFill: Platform.select({
    ios: Color.ios.tertiarySystemFill,
    default: 'rgba(118, 118, 128, 0.12)',
  })!,

  /**
   * Platform accent. iOS resolves to the system blue (or the user's chosen
   * accent); Android to the Material You primary. Prefer leaving native controls
   * untinted — reach for this only where a color value is required.
   */
  accent: Platform.select({
    ios: Color.ios.systemBlue,
    default: '#007aff',
  })!,
  /** Content color on top of `accent`. */
  onAccent: Platform.select({
    ios: Color.ios.lightText,
    default: '#ffffff',
  })!,
  /**
   * Opaque content on a *saturated* accent fill — the calendar's selected day
   * number and its dots.
   *
   * `onAccent` resolves to UIKit's `lightText`, which is white at 60% alpha:
   * UIKit's token for text over dark photographic content, and roughly 2:1
   * against `systemBlue`. There is no semantic UIKit color that stays white in
   * both appearances (`systemBackground` inverts), so this one is a literal by
   * necessity rather than an oversight. Reach for it only over a filled accent
   * shape; everywhere else the semantic label tokens are correct.
   */
  onAccentSolid: '#ffffff',

  /** Destructive / error. */
  systemRed: Platform.select({
    ios: Color.ios.systemRed,
    default: '#ff3b30',
  })!,
  /** Success / completed status. */
  systemGreen: Platform.select({
    ios: Color.ios.systemGreen,
    default: '#34c759',
  })!,
  /** In-progress / warning status. */
  systemOrange: Platform.select({
    ios: Color.ios.systemOrange,
    default: '#ff9500',
  })!,
  /** Neutral gray, for de-emphasised glyphs. */
  systemGray: Platform.select({
    ios: Color.ios.systemGray,
    default: '#8e8e93',
  })!,
} as const;
