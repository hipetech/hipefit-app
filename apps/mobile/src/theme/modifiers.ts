import {
  buttonStyle,
  disabled,
  font,
  foregroundStyle,
  frame,
  lineLimit,
  listStyle,
  monospacedDigit,
  redacted,
} from '@expo/ui/swift-ui/modifiers';

import { colors } from '@/theme/colors';

/**
 * Shared `@expo/ui` (SwiftUI) modifier arrays.
 *
 * This is the SwiftUI half of the typography vocabulary that `ui/text.tsx` owns
 * on the React Native side. The names are deliberately built from the two
 * vocabularies that already exist: the `textStyle` union of `@expo/ui`'s
 * `font()` modifier (`footnote`, `body`, `headline`, `subheadline`, `title3`, …)
 * and the keys of `@/theme/colors` (`label`, `secondaryLabel`, `systemRed`), so
 * an RN `Text` and a SwiftUI `Text` are described with the same words.
 *
 * Editing an entry here moves every screen that uses it. When one site needs to
 * differ, inline the modifier array at that one site — never edit the shared
 * value to suit a single caller.
 *
 * Compose only at the ends: `[...mods.bodyLabel, dyn]` or `[dyn, ...mods.bodyLabel]`.
 * Never splice a dynamic modifier into the middle of one of these arrays.
 * `@expo/ui` applies the array with a reduce, so index 0 is the *innermost*
 * modifier and the order is semantics, not style. If the dynamic modifier
 * belongs mid-sequence, keep the whole array inline at the call site.
 *
 * Never write `as const` on these arrays. The `modifiers` prop is typed as a
 * mutable `ModifierConfig[]`, and a `readonly` tuple will not assign to it
 * (TS4104).
 *
 * `primaryActionButtonDisabled` bundles `disabled(true)` on purpose: the two
 * "Add to Workout" buttons are both waiting on the workout player, and sharing
 * one constant means the two "drop `disabled(true)` when the workout player
 * ships" TODOs get dropped together rather than one being forgotten.
 *
 * Note that the `frame({ maxWidth: Infinity })` used by the button entries is a
 * *different* shape from the `frame({ maxWidth: Infinity, alignment: 'leading' })`
 * used for layout in `features/exercises/exercise-row.tsx`. One stretches a
 * control to fill its row; the other stretches a text column and left-aligns its
 * content. They must never be merged into one constant.
 */
export const mods = {
  /** Secondary supporting text — captions, metadata, row subtitles. */
  footnoteSecondary: [
    font({ textStyle: 'footnote' }),
    foregroundStyle(colors.secondaryLabel),
  ],
  /** Footnote-sized text that is still primary content. */
  footnoteLabel: [
    font({ textStyle: 'footnote' }),
    foregroundStyle(colors.label),
  ],
  /** Default body text. */
  bodyLabel: [font({ textStyle: 'body' }), foregroundStyle(colors.label)],
  /** Body text in the secondary tier — trailing values, de-emphasised rows. */
  bodySecondary: [
    font({ textStyle: 'body' }),
    foregroundStyle(colors.secondaryLabel),
  ],
  /** Destructive body text — sign out, delete. */
  bodyDestructive: [
    font({ textStyle: 'body' }),
    foregroundStyle(colors.systemRed),
  ],
  /** Emphasised body text — row titles, card headings. */
  headlineLabel: [
    font({ textStyle: 'headline' }),
    foregroundStyle(colors.label),
  ],
  /** Section subtitles and secondary headings. */
  subheadlineSecondary: [
    font({ textStyle: 'subheadline' }),
    foregroundStyle(colors.secondaryLabel),
  ],
  /** `footnoteSecondary`, clamped to a single line. */
  footnoteSecondaryOneLine: [
    font({ textStyle: 'footnote' }),
    foregroundStyle(colors.secondaryLabel),
    lineLimit(1),
  ],
  /** `headlineLabel`, clamped to a single line. */
  headlineLabelOneLine: [
    font({ textStyle: 'headline' }),
    foregroundStyle(colors.label),
    lineLimit(1),
  ],
  /** Body text for counters that update in place — tabular digits stop jitter. */
  bodyLabelMono: [
    font({ textStyle: 'body' }),
    foregroundStyle(colors.label),
    monospacedDigit(),
  ],
  /**
   * Title-sized text that inherits the surrounding foreground color — the
   * leading SF Symbol on a list row.
   *
   * Sized with a text style rather than a fixed `size` so the glyph scales with
   * Dynamic Type alongside the labels beside it; a fixed `size` does not. A
   * `font` modifier also *supersedes* `size`, so the two must never be combined.
   */
  title3: [font({ textStyle: 'title3' })],
  /** The grouped-list look used by Home, Workouts and Settings. */
  listInsetGrouped: [listStyle('insetGrouped')],
  /**
   * The same grouped list in its loading state. `disabled(true)` accompanies
   * the redaction so placeholder rows cannot be tapped while they shimmer.
   */
  listInsetGroupedRedacted: [
    listStyle('insetGrouped'),
    redacted('placeholder'),
    disabled(true),
  ],
  /** Full-width secondary button. */
  secondaryActionButton: [
    buttonStyle('bordered'),
    frame({ maxWidth: Infinity }),
  ],
  /** Full-width primary button, disabled until the workout player ships. */
  primaryActionButtonDisabled: [
    buttonStyle('borderedProminent'),
    frame({ maxWidth: Infinity }),
    disabled(true),
  ],
  /** Disable a control without changing anything else about it. */
  disabledOnly: [disabled(true)],
};
