---
type: app
status: current
area: ui
updated: 2026-08-04
---

# The UI system

The app renders **real SwiftUI from React**, through `@expo/ui`. There is no cross-platform component
abstraction under it and no styling framework over it: no Tailwind, no `className`, no CSS, no theme
provider. Metro carries no `global.css` and no uniwind configuration, and the root layout wraps only
`GestureHandlerRootView` ([app/\_layout.tsx](../../app/_layout.tsx)). Everything below is a
consequence of that choice.

This document is the authority for building screen bodies. Navigation chrome — titles, toolbars,
search bars, tabs and the global create button — belongs to [navigation.md](navigation.md); the
layer map and the route/feature split are in [architecture.md](architecture.md).

## Three vocabularies and one bridge

A screen is composed from three things that look similar and are not:

- the **React Native tree** — `View`, `StyleSheet`, `expo-image`, `LegendList`;
- the **SwiftUI tree**, imported from `@expo/ui/swift-ui` — `VStack`, `HStack`, `Spacer`, `Text`,
  `List`, `Section`, `Button`, `Menu`, `Picker`, `Alert`, `DisclosureGroup`, plus the `modifiers`
  vocabulary from `@expo/ui/swift-ui/modifiers`;
- the **`ui/` primitives**, which package a recurring shape in one or the other of those.

`Host` is the bridge from the RN tree into a SwiftUI tree, and `RNHostView` is the bridge back. Both
are one-way doors: **no flexbox, no RN style objects and no RN components exist inside a `Host`** —
layout there is SwiftUI stacks plus `modifiers`, and text is the SwiftUI `Text`, not
[ui/text.tsx](../../ui/text.tsx).

## `Host` ownership

**One `Host` per island, never nested.** Import `Host` only from the `@expo/ui` root, never from
`@expo/ui/swift-ui`. Pass `colorScheme={useAppColorScheme()}`
([hooks/use-app-color-scheme.ts](../../hooks/use-app-color-scheme.ts)).

**Never pass `seedColor`.** Leaving it unset makes SwiftUI adopt the system accent, which is the
intended look — the app deliberately has no brand color so it reads as a native Apple app. The
rationale is recorded at the top of [theme/colors.ts](../../theme/colors.ts) (`theme/colors.ts:12-16`),
which also warns that the `accent` token exists for RN tint props only and must never be used to pin
a `seedColor`.

A `List` has **no intrinsic content height**, so it can only live at the root of a `Host` that owns
real space: `style={layout.groupedScreen}` with `flex: 1` and deliberately **no** `matchContents`.
Nesting a `List` inside an RN `ScrollView`, or measuring its `Host` with `matchContents`, renders
nothing at all. Row-sized islands are the opposite case and use
`matchContents={{ vertical: true }}` — see
[features/exercises/exercise-row.tsx](../../features/exercises/exercise-row.tsx) against
[features/home/home-content.tsx](../../features/home/home-content.tsx).

Remote images inside a `Host` go through `RNHostView` + `expo-image`, **never a second `Host`**:
SwiftUI's `Image` cannot load a URL. `RNHostView` attaches an `RCTSurfaceTouchHandler` to the hosted
RN view, whose gesture recognizer swallows taps meant for an enclosing SwiftUI `Button`, so a purely
presentational hosted image must carry `pointerEvents="none"` —
[ui/avatar.tsx](../../ui/avatar.tsx) documents the case that found this (the Settings profile row),
and [features/exercises/exercise-detail-sheet.tsx](../../features/exercises/exercise-detail-sheet.tsx)
is the other call site.

## Component files and props

**One file per component. No platform splits.** The old `<name>.d.ts` + `<name>.ios.tsx` +
`<name>.android.tsx` triple is gone; write a plain `<name>.tsx` that imports `@expo/ui/swift-ui`
directly. **Do not reintroduce `.ios.tsx` / `.android.tsx` suffixes.** Reviving Android is a
deliberate project-wide decision, not something to reinstate one component at a time.

A reusable component declares and **exports** its own `Props` interface with a doc comment per prop
and the default recorded as `@default` — `CardProps`, `ChipProps`, `AvatarProps`, `SeparatorProps`,
`ExerciseRowProps`. The two plain-RN primitives are the exception rather than the pattern:
[ui/text.tsx](../../ui/text.tsx) extends React Native's own `Text` props and exports only the
`TextVariant` union, and [ui/progress.tsx](../../ui/progress.tsx) keeps `ProgressProps` file-local.

## The `ui/` primitives

Seven files, and the inventory is complete as written:

| Primitive                           | Tree     | Notes                                                       |
| ----------------------------------- | -------- | ----------------------------------------------------------- |
| [Card](../../ui/card.tsx)           | SwiftUI  | Host-less surface container; border-box `width`             |
| [Chip](../../ui/chip.tsx)           | SwiftUI  | Capsule status label; variants map to system status colors  |
| [Separator](../../ui/separator.tsx) | SwiftUI  | Native `Divider` horizontally, a tinted 1pt rule vertically |
| [Avatar](../../ui/avatar.tsx)       | SwiftUI  | Circular image via `RNHostView`, initials fallback          |
| [Text](../../ui/text.tsx)           | Plain RN | Apple's 11 text styles — see [Typography](#typography)      |
| [Progress](../../ui/progress.tsx)   | Plain RN | Determinate bar; **no call sites today**                    |
| [Image](../../ui/Image.tsx)         | Plain RN | A one-line re-export of `expo-image`                        |

The four SwiftUI primitives are **host-less** — they compose inside a screen's `Host` and must never
open one of their own. The three plain-RN primitives are usable anywhere in the RN tree and nowhere
inside a `Host`.

Add to `ui/` only when a shape has more than one call site. Anything with a single call site stays
in its feature directory, where its rationale can live beside the screen that needs it.

## Color and theme

[theme/colors.ts](../../theme/colors.ts) is the **only** source of color. Tokens resolve to UIKit
semantic colors through `Color.ios.*` — the type-safe `expo-router` wrapper, never raw
`PlatformColor` — wrapped in `Platform.select` purely to supply a `default` web fallback. That
`Platform.select` is the one sanctioned platform branch in the codebase. No hardcoded hex anywhere
else, and no brand accent.

Two tokens carry rules rather than values. `systemGroupedBackground` — not `systemBackground` — is
the correct backdrop behind `insetGrouped` rows, which is why
[theme/styles.ts](../../theme/styles.ts) names it once as `layout.groupedScreen` instead of letting
each grouped screen re-decide. And `accent` exists only for RN tint props; native controls are left
untinted so they pick up the system accent.

The user's theme preference lives at `profile.settings.theme` in Firestore and reaches the UI by two
paths from one hook: [hooks/use-app-color-scheme.ts](../../hooks/use-app-color-scheme.ts) maps it to
`'light' | 'dark' | undefined` (undefined meaning "follow the device"), the root layout applies it
app-wide with `Appearance.setColorScheme` ([app/\_layout.tsx](../../app/_layout.tsx)), and every
`Host` receives the same value as `colorScheme`. Settings writes the preference through a menu
`Picker` in a grouped row ([features/settings/settings-content.tsx](../../features/settings/settings-content.tsx)).

## Where styles live

**Static styles and modifier arrays live at module scope, above the component.** JSX carries only
what genuinely depends on props or state.

RN styles go through one `const styles = StyleSheet.create({…})` per file. Hoisting them is safe
even though they hold semantic colors: `StyleSheet.create` is an identity function that only freezes
entries in `__DEV__`, so the `Color.ios.*` tokens stored inside still resolve against the live
light/dark trait at render time.

`@expo/ui` modifier arrays are plain `const` arrays instead, because `StyleSheet.create` is typed for
`ViewStyle`/`TextStyle`/`ImageStyle` and `ViewModifier[]` is none of those. **Never write `as const`
on a modifier array** — the `modifiers` prop is a mutable `ModifierConfig[]` and a `readonly` tuple
will not assign to it (TS4104).

File-local arrays are `SCREAMING_SNAKE` with a `_MODIFIERS` suffix. Cross-file shapes live in
[theme/styles.ts](../../theme/styles.ts) (`layout.*`) and [theme/modifiers.ts](../../theme/modifiers.ts)
(`mods.*`). Editing a shared entry moves every screen that uses it — when one site needs to differ,
**inline that one site**, never edit the shared value. Two arrays that happen to look alike are not
the same constant: `mods.secondaryActionButton`'s `frame({ maxWidth: Infinity })` stretches a control
to fill its row, while `FILL_LEADING` in
[features/exercises/exercise-row.tsx](../../features/exercises/exercise-row.tsx) adds
`alignment: 'leading'` to stretch a text column and left-align it. They must never be merged.

## Modifier order is semantics

`@expo/ui` applies a modifier array with a **reduce**, so **index 0 is the innermost modifier** and
the last entry is the outermost — exactly like writing the Swift chain by hand. Order is meaning,
not formatting.

Three consequences:

- **Compose only at the ends**: `[...mods.bodyLabel, dyn]` or `[dyn, ...mods.bodyLabel]`. Never
  splice a dynamic modifier into the middle of a hoisted run. If the dynamic modifier belongs
  mid-sequence, keep the whole array inline at that call site —
  [ui/chip.tsx](../../ui/chip.tsx) is the worked example, with its one variant-dependent
  `foregroundStyle` at index 1 of 7.
- **Placement is load-bearing, and the reasoning belongs in a comment.**
  [ui/card.tsx](../../ui/card.tsx) documents at length why `frame` must sit after `padding` (so
  `width` is the card's outer width) and before `background` (because `.background` reports the
  primary content size, and a `VStack` hugs its widest child rather than filling a proposed width —
  which is what made fixed-width routine cards render at visibly uneven widths).
- **Font-refining modifiers must follow the modifier that sets the font.** `monospacedDigit()` after
  `font(...)` refines the resolved font; the other order overwrites it. Motion modifiers go after
  both, outermost.

## The repository deliberately overrides the bundled Expo skills

Both [`.agents/skills/expo-native-ui/SKILL.md:109`](../../.agents/skills/expo-native-ui/SKILL.md) and
[`.agents/skills/building-native-ui/SKILL.md:121`](../../.agents/skills/building-native-ui/SKILL.md)
say "Inline styles not StyleSheet.create unless reusing styles is faster". In this repository reusing
**is** the default and hoisting is the rule, for the ordering and drift reasons above.

The skills are vendored from upstream (`source: expo/skills`, tracked by `computedHash` in
`skills-lock.json`), so editing them would be clobbered on the next sync and would invalidate the
recorded hash. That is why the divergence is recorded here instead. **Do not "correct" the codebase
back to match the skills.**

## Typography

One vocabulary spans both trees. [ui/text.tsx](../../ui/text.tsx) exposes Apple's 11 text styles
under exactly the names in the `textStyle` union of `@expo/ui`'s `font()` modifier — `largeTitle ·
title · title2 · title3 · headline · body · callout · subheadline · footnote · caption · caption2` —
so an RN `Text` and a SwiftUI `Text` are described with identical words, and `mods.footnoteSecondary`
and `<Text variant="footnote">` are the same idea on the two sides of the bridge.

Always `font({ textStyle })`, never `font({ size })`: a fixed size is frozen and ignores Dynamic
Type, and a `font` modifier supersedes `size`, so the two must never be combined. This applies to SF
Symbols too — `mods.title3` sizes a leading list glyph with a text style so it scales alongside the
labels beside it.

On the RN side the same discipline needs one extra prop. `ui/text.tsx` passes a per-variant
`dynamicTypeRamp` because RN otherwise applies a single flat multiplier, while Apple's ramps are not
uniform — at accessibility sizes `body` grows proportionally much more than `largeTitle`. Passing the
ramp routes scaling through `UIFontMetrics` for that style, which is the curve SwiftUI's
`font({ textStyle })` already follows, so RN text and SwiftUI text inside a `Host` scale together
instead of drifting apart. Never set `allowFontScaling={false}`.

The one sanctioned exception to the text-style rule is [ui/avatar.tsx](../../ui/avatar.tsx), whose
initials are sized relative to a fixed-pixel circle that cannot itself scale; the file carries the
full argument, including the fact that its `expo-image` branch has no Dynamic Type support at all.

Variants are **typography only**. `textAlign`, margins, padding, borders and any color beyond the
`label` base belong at the call site.

Counters that update in place take `monospacedDigit()` (SwiftUI) or `fontVariant: ['tabular-nums']`
(RN) so the digits stop jittering. Reserve them for standalone figures: fixed-width digits inside a
descriptive sentence fragment ("6 exercises · 45 min") read as a typographic mistake, which is why
[features/home/home-content.tsx](../../features/home/home-content.tsx) applies them to the three
Activity values and to nothing else on the screen.

## Lists: bounded grouped lists versus the one catalogue

**The default idiom is a SwiftUI `List` + `Section` + `listStyle('insetGrouped')` inside one
screen-filling `Host`** — Home, Workouts and Settings all take this shape. `insetGrouped` supplies
the 16pt margins, 44pt row heights, inset hairlines and grouped background for free, which is why
none of those screens contains a hand-rolled width, padding or gap constant. Use `mods.listInsetGrouped`
and, while stores load, `mods.listInsetGroupedRedacted` — redaction over the real structure with
plausible placeholder values, so there is one code path, no skeleton components and no layout jump.

A `List` is **not virtualized**: every row is a live JSX node, so it suits bounded content only.
[Exercises](<../../app/(private)/exercises/index.tsx>) is the deliberate exception. The catalogue is
unbounded, so it keeps `@legendapp/list` with each row as its own `Host` island
([features/exercises/exercise-row.tsx](../../features/exercises/exercise-row.tsx)) and reproduces the
grouped look by hand from the **measured** constants in
[features/exercises/row-metrics.ts](../../features/exercises/row-metrics.ts). Those values track what
SwiftUI actually draws rather than a documented figure: the real corner radius is ~22pt on iOS 26,
not the widely-quoted 10pt, and the section margin measured 16pt rather than the often-quoted 20pt.
**Re-measure them, do not re-derive them** — and note that `GROUPED_SEPARATOR_INSET` is documented as
the sum of the section padding, the leading glyph frame and the gap between glyph and text, so
changing any of those three means measuring again rather than recomputing.

Two `Section` traps, both found the hard way:

- **`title` and `header` are mutually exclusive.** The Swift side reads the custom `header` slot only
  when `title` is unset, so a non-empty `title` silently wins. Prefer `header` when you need control.
- **`badge()` on a `Section` is broken.** It does not decorate the header; it collapses the title
  _into_ the first row, so the heading renders beside the row content with the count floating right.
  The supported escape hatch is a custom `header` node — `SectionHeader` in
  [features/workouts/workouts-content.tsx](../../features/workouts/workouts-content.tsx) is the
  worked example, and it deliberately sets **no** font or color, because the list style publishes the
  header font, color and text case through the SwiftUI environment and a plain child view inherits
  them. Hard-coding `footnote` + `secondaryLabel` there would look right today and drift from the
  sections that still use `title`.

Empty sections are a plain secondary-label row plus a `Section` footer, never a
`ContentUnavailableView` — that is a whole-view treatment, and dropping one into a row recreates the
tall centred empty card the grouped-list migration deleted.

## Hit testing and accessibility

**A SwiftUI `Menu` hit-tests and labels its `label` view, not the `Menu`.** Modifiers on the `Menu`
reach the menu _container_ and silently do nothing to the interactive part. This has bitten twice:
first with `accessibilityLabel`, which produced two accessibility nodes, one of them a stray
full-screen element; then with `contentShape`, which had no effect at all (measured). Anything
concerning **hit area, accessibility or the appearance of the control itself** goes on the leaf
inside `label`; only appearance of the container belongs on the `Menu`.

A glyph is only as tappable as it is large. Pair `frame(...)` with `contentShape(...)` **on the
label, in that order** — `frame` alone is not enough, because hit-testing follows drawn content
rather than layout bounds. A 24pt glyph centred in a 60pt circle otherwise leaves an 18pt dead ring
and fails Apple's 44pt minimum target.
[features/floating-action-button/create-floating-action-button.tsx](../../features/floating-action-button/create-floating-action-button.tsx)
keeps its label modifiers and its container modifiers in two separate arrays for exactly this reason;
that control's own contract is in [navigation.md](navigation.md).

Two more rules the screens already follow. Decorative glyphs are hidden from VoiceOver with
`accessibilityHidden(true)` so a row announces once — the hand-drawn disclosure chevron in
[features/settings/settings-content.tsx](../../features/settings/settings-content.tsx) is the case
in point. And where a container's `accessibilityLabel` is synthesized from its children, sibling
controls announce identically and need `accessibilityIdentifier` to stay distinguishable, as the two
buttons inside each expanded row of
[features/exercises/exercise-row.tsx](../../features/exercises/exercise-row.tsx) do.

## Haptics

Feedback goes through [lib/haptics.ts](../../lib/haptics.ts) under **intent names** —
`hapticSelection`, `hapticImpact`, `hapticSuccess` — never raw `expo-haptics`. The wrapper is
iOS-gated and fire-and-forget, so a haptic that fails (no Taptic Engine, Low Power Mode, simulator)
cannot reject into the interaction it decorates. It also keeps the mapping from event kind to
generator in one place.

`@expo/ui` exposes **no** `sensoryFeedback` modifier — verified against the modifier export list at
57.0.7 — so feedback must fire from JS inside the existing event callback.

Fire only on a meaningful state change: not when re-selecting an already-selected value, not on
`disabled` or redacted placeholder rows, and never on a failure path (a failure the user must read
about is announced by the UI, not by the Taptic Engine). `Switch`, `Picker` and `DateTimePicker`
carry built-in haptics; adding more double-fires.

## Motion

**Motion is native, not Reanimated.** Reanimated cannot reach inside a `Host` to animate SwiftUI
content, so it is not the tool for the `List`-based screens; where a transition already exists
natively — a `DisclosureGroup`'s chevron rotation and reveal — use it, since UIKit's own animation
cannot desync from a recycled row the way a `useAnimatedStyle` pair could.

Numbers that change in place use `contentTransition('numericText')` plus `animation(...)`, both
applied **outermost**, after `font` and `monospacedDigit`. `contentTransition` alone never runs:
`animation` supplies the transaction that drives it. Animate only values that genuinely mutate in
place — a logged workout's duration is immutable and gains nothing. Keep durations at or under
300ms; the Activity counters use 250ms ease-in-out, against Apple's `Animation.default` of roughly
350ms, which reads as draggy on a three-row stat block.

**SwiftUI does not honour Reduce Motion for you.** `@expo/ui`'s `animation` modifier is a thin
pass-through to `.animation(_:value:)` with no accessibility check
(`AnimationModifier` in `node_modules/@expo/ui/ios/Modifiers/ViewModifierRegistry.swift`), and the
SwiftUI environment value cannot be read from JS. Gate on
[hooks/use-reduce-motion.ts](../../hooks/use-reduce-motion.ts) and **drop the motion modifiers
entirely** rather than animating to zero duration.

Gate on loading state as well. `.animation(_:value:)` never animates the first time it is applied, so
introducing it at the moment redaction lifts is what stops placeholder figures from visibly rolling
into the real ones — see `counterModifiers` in
[features/home/home-content.tsx](../../features/home/home-content.tsx), which returns the static base
array whenever the stores are loading or Reduce Motion is on, leaving the redacted modifier arrays
byte-identical to what they were before.
