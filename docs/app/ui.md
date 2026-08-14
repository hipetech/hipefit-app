---
type: app
status: current
area: ui
updated: 2026-08-12
---

# The UI system

The app renders **real SwiftUI from React**, through `@expo/ui`. There is no cross-platform component
abstraction under it and no styling framework over it: no Tailwind, no `className`, no CSS, no theme
provider. Metro carries no `global.css` and no uniwind configuration, and the root layout wraps only
`GestureHandlerRootView` ([app/\_layout.tsx](../../app/_layout.tsx)). Everything below is a
consequence of that choice.

This document is the authority for building screen bodies. Navigation chrome — titles, toolbars,
search bars, tabs and the global create dock — belongs to [navigation.md](navigation.md); the
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
[features/avatar/avatar.tsx](../../features/avatar/avatar.tsx) documents the case that found this
(the Settings profile row),
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

Six files, and the inventory is complete as written:

| Primitive                           | Tree     | Notes                                                       |
| ----------------------------------- | -------- | ----------------------------------------------------------- |
| [Card](../../ui/card.tsx)           | SwiftUI  | Host-less surface container; border-box `width`             |
| [Chip](../../ui/chip.tsx)           | SwiftUI  | Capsule status label; variants map to system status colors  |
| [Separator](../../ui/separator.tsx) | SwiftUI  | Native `Divider` horizontally, a tinted 1pt rule vertically |
| [Text](../../ui/text.tsx)           | Plain RN | Apple's 11 text styles — see [Typography](#typography)      |
| [Progress](../../ui/progress.tsx)   | Plain RN | Determinate bar; **no call sites today**                    |
| [Image](../../ui/Image.tsx)         | Plain RN | A one-line re-export of `expo-image`                        |

The three SwiftUI primitives are **host-less** — they compose inside a screen's `Host` and must never
open one of their own. The three plain-RN primitives are usable anywhere in the RN tree and nowhere
inside a `Host`.

Avatar is a shared feature rather than a generic UI primitive. The component, fixed artwork palette,
and deterministic seed selection live together under [`features/avatar/`](../../features/avatar).
It uses a supplied stable user seed to choose one of 14 pastel vertical gradients. Each swatch
specifies dark or light initials for contrast, and a display-name edit does not change the selected
background. Names render the first and final initials; when `source` is present, `expo-image` crops
it to fill the same circle instead. Home uses it in a transparent greeting row, while Settings uses
it in the profile row. The component accepts an image URI but the app has no photo picker or upload
path.

Add to `ui/` only when a generic shape has more than one call site. Anything with a single call site
stays in its feature directory, where its rationale can live beside the screen that needs it. Avatar
is shared but remains a feature because its domain-specific palette and identity rules belong with
the component rather than in cross-cutting modules.

## When a hand-written native view is correct

`@expo/ui` is the default and stays the default. The app has **one** hand-written native view:
[`packages/navigation-dock/`](../../packages/navigation-dock/index.ts), a workspace package consumed
as `@hipefit/navigation-dock`, whose `NavigationDockView` is a UIKit `ExpoView` — the create action
panel and the scrim behind it, drawn in UIKit rather than SwiftUI. It draws no button: Create is a
`UITabBar` item, for the reason given in [navigation.md](navigation.md). Where such packages live and
how they are linked is in [architecture.md](architecture.md#packages-the-local-native-boundary); this
section is about when reaching for one is justified and what the resulting view owes.

Write a UIKit `ExpoView` only when the view needs something the SwiftUI bridge structurally cannot
give it. Three such requirements produced this one:

- **It must pass touches through where it is not drawing.** That means owning `hitTest`. A
  `UIHostingController`'s view answers for its whole frame and offers no supported way to say "not
  here", so a full-screen SwiftUI overlay would swallow the screen.
- **It must move VoiceOver focus to a specific control.** Posting a focus notification needs a
  stable `UIView` to pass as the argument, which a SwiftUI subtree does not hand back.
- **It needs presentation semantics with no `@expo/ui` equivalent** — `accessibilityViewIsModal`,
  `accessibilityPerformEscape`.

If none of those apply, the answer is a `Host` and `@expo/ui`. Wanting a custom look is not a
reason; neither is an animation, which SwiftUI can express.

**The bridge is props in, events out.** The module declares no `Function` or `AsyncFunction`, so
React cannot drive the view out of band and there is no second source of truth for its state: React
owns `expanded`, native owns everything drawn, and the view animates toward whatever prop arrives —
it has no press to interpret, since the button that toggles it is a tab bar item outside this view
entirely. Prop setters record what changed and a single `OnViewDidUpdateProps` applies the commit as
one unit, so the view never draws a frame built from some new props and some old ones. The three-way
ownership split is tabulated in [navigation.md](navigation.md).

### Materials and the pre-26 fallback

**The card's glass is SwiftUI, hosted inside the UIKit view.**
[`DockGlassSurface.swift`](../../packages/navigation-dock/ios/DockGlassSurface.swift) renders it and
handles both sides of the iOS 26 line — `glassEffect` above, `.regularMaterial` below. It is the
module's only SwiftUI, and the reason is animation rather than taste: a `CAAnimation` attached to a
`UIGlassEffect` surface or any ancestor composites its system-drawn shadow twice, and SwiftUI's
animation engine does not attach one. That file carries the measurement, the six falsified UIKit
routes, and the numbers on both sides. It replaced a `MaterialSurfaceView` wrapper around
`UIVisualEffectView`, which no UIKit animation could fade cleanly.

**Only the background is SwiftUI.** The grid, the scroll view and every control stay UIKit, drawn as
siblings on top rather than children — which is what keeps `hitTest` UIKit's and lets the grid keep
fading through `UIView.animate` without reintroducing the artifact.

**The backdrop is not one of them, and no longer draws anything at all.** It has been three things:
a full-screen `.systemUltraThinMaterial`, which obscured the screen and starved the card — glass
renders by refracting what is behind it, so a card floating on an already-blurred backdrop had
nothing left to sample and stopped reading as a surface; then a black dimming scrim, which fixed the
glass but still shaded the whole app; now nothing. The card's own material is what separates it from
the content, exactly as in the reference.

**The view survives with a clear background because its job was never the shade.** It covers the
whole screen, captures the dismiss tap, blocks every touch behind it, and carries
`accessibilityViewIsModal`. An invisible modal barrier is still a modal barrier. Two earlier
revisions stopped it short of the tab bar — one the dimming, one the touches — and both were wrong:
the first drew a bright band across the bottom of a dimmed screen, the second left a tab bar that
still navigated from under a scrim.

The OS split is an **availability check, never a preprocessor branch**, so one code path is compiled
and shipped for every supported version. Glass is gated three times over: `#if compiler(>=6.2)`
because `UIGlassEffect` does not exist in pre-Xcode-26 SDKs and would not compile; `@available(iOS
26.0, *)`; and an `NSClassFromString` runtime probe, because early iOS 26 betas vend a
`UIGlassEffect` whose initializer fails. Below that, the fallback is a `UIVisualEffectView` with
`.systemChromeMaterial` — what UIKit puts behind its own bars, so the dock reads as chrome rather
than as a sheet.

Two ordering traps are encoded in that file and must not be "simplified" away: a glass effect
assigned before the view has a non-zero size renders nothing, and re-assigning one without tearing
down the old effect leaves the surface blank. So the effect is applied on the first real layout pass
and not again.

**Not verified below iOS 26.** The glass path was confirmed at runtime on an iOS 26.5 simulator. The
16.4–25 fallback has never been seen — no pre-26 simulator runtime exists on this machine — so its
appearance is reasoned from the API, not observed. Treat it as unverified until someone runs it.

### Pass-through hit testing

A full-screen overlay that is mostly empty must return `nil` from `hitTest` for the parts it does
not want, or it takes the whole screen away from the tab bar and the list underneath. The rule the
dock uses is the whole rule: `super.hitTest` already returns the deepest view that claims the point,
and the panel and scrim are `isHidden` while collapsed, so a hit that lands on the overlay _itself_
means nothing in it wanted the touch — return `nil` and it falls through. Expanded there is no rule
at all: the overlay claims every point, because the panel is modal.

Two related distinctions, both easy to get backwards:

- A decorative `UIVisualEffectView` inside a control must set `isUserInteractionEnabled = false`, or
  it consumes the touch before the control sees it.
- A **disabled** control uses `isEnabled = false`, never `isUserInteractionEnabled = false`. A
  disabled `UIControl` is still hit-tested and fires nothing, which is what makes a disabled action
  swallow its touch; switching off interaction would drop the touch onto whatever is behind it.

### Native motion

The dock's motion is UIKit's, and it follows the same principle as the SwiftUI screens: one
animation drives every view that participates. Since the backdrop became invisible, that is a single
property — the panel's `alpha`, in one `UIView.animate` block. There is **no transform**. A glass
surface's shadow is drawn by the system and does not follow a scale, which showed up as a halo wider
and darker than the card for the first frames of every open; a translation avoided that but bought
nothing a fade does not already do. The backdrop still takes part in the _timing_: it is unhidden
before the animation and re-hidden in the completion, so it blocks touches for the whole
presentation rather than only once the panel has landed. The Create glyph is not part of it — a tab
bar item cannot cross-fade between two images, so it swaps. That is the one piece of motion given up
by moving the button into the bar.

**Reduce Motion is a prop, not an automatic behaviour** — UIKit no more honours it for you than
SwiftUI does. `reduceMotion` comes from [hooks/use-reduce-motion.ts](../../hooks/use-reduce-motion.ts),
the same hook the `List` screens gate on. With the motion already reduced to a cross-fade for
everyone, that path only shortens it.

**Two animations, deliberately.** SwiftUI fades the glass; `UIView.animate` fades the grid. They run
the same curve and duration and look like one animation, and splitting them is what removes the
doubled-shadow artifact rather than a compromise around it: the glass never gets a `CAAnimation`, and
the grid is a sibling of the glass rather than an ancestor, so its animation cannot reach it.
Fading the _card_ instead would put the animation above the glass and bring the halo straight back —
[`DockGlassSurface.swift`](../../packages/navigation-dock/ios/DockGlassSurface.swift) carries the
measurement and the six falsified alternatives. Check it before re-investigating.

### Accessibility rules for a native overlay

- **Modality follows the state, not the animation.** `accessibilityViewIsModal` is set the moment
  the panel is requested, so the tab bar behind it stops being reachable immediately rather than
  when the spring settles.
- **The scrim is hidden from VoiceOver** (`accessibilityElementsHidden`). A full-screen "Dismiss"
  element would sit in front of the panel and be the first thing a swipe reaches. Escape is served
  by `accessibilityPerformEscape`, which emits the same dismissal a scrim tap does — and it is the
  _only_ route for a VoiceOver user, because `accessibilityViewIsModal` also hides the tab bar and
  therefore the Close button. The scrim blocks that region for everyone, so this matches the sighted
  behaviour rather than diverging from it.
- **Focus is posted explicitly on both edges**, with `.layoutChanged`: to the first action on
  expand — a container argument makes VoiceOver pick its own starting element, which lands on the
  scroll view — and to `nil` on dismiss, asking UIKit to re-read the screen. It cannot name the
  Create button any more: that control belongs to the tab bar, and this view has no reference to it.
- **Expanded state is spelled in the button's label**, "Create" / "Close", not in a selected trait —
  set on the trigger in the tab layout, not here.
- **Dynamic Type is structural, not observed.** Sizes come from text-style SF Symbols and
  `adjustsFontForContentSizeCategory` labels, so a content-size change invalidates intrinsic sizes
  and re-solves the layout by itself — which is why the module installs no trait observer and
  overrides no `traitCollectionDidChange`. On the action controls Apple's 44pt minimum is a `>=`
  constraint, so they clear it and can still grow past it.
- **Nothing here is pinned to a measured size.** There used to be one exception — a fixed 60pt
  Create circle, coupled to a list's content inset — and it went away with the button itself, which
  is now a `UITabBar` item UIKit sizes.
  [`DockLayout.swift`](../../packages/navigation-dock/ios/DockLayout.swift) holds padding and motion
  values only; the single number the module cannot derive is the vertical offset, and React supplies
  it.

## Color and theme

[theme/colors.ts](../../theme/colors.ts) is the source of semantic app color. Tokens resolve to UIKit
semantic colors through `Color.ios.*` — the type-safe `expo-router` wrapper, never raw
`PlatformColor` — wrapped in `Platform.select` purely to supply a `default` web fallback. That
`Platform.select` is the one sanctioned platform branch in the codebase, and there is no brand
accent. The one fixed-artwork exception is the 14-swatch reference palette in
[`features/avatar/avatar-backgrounds.ts`](../../features/avatar/avatar-backgrounds.ts); those colors
must not adapt because they reproduce selectable artwork rather than semantic UI roles.

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

The one sanctioned exception to the text-style rule is
[features/avatar/avatar.tsx](../../features/avatar/avatar.tsx), whose
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

## The calendar: a React Native island inside the `List`

Home's expandable calendar
([features/calendar/index.tsx](../../features/calendar/index.tsx))
is the app's one substantial React Native island rendered _through_ the SwiftUI tree rather than
beside it. [features/home/home-content.tsx](../../features/home/home-content.tsx) puts it in an
`RNHostView matchContents` row of the screen's `List`, and strips the `insetGrouped` card off that
one row so the grid reads as part of the page — `listSectionMargins`, `listRowInsets`,
`listRowBackground` and `listRowSeparator`, all four, because `listSectionMargins` is what actually
owns the horizontal 16pt under `insetGrouped` and `listRowInsets` alone leaves it in place. The
island must not open a `Host` of its own; it is already inside one.

A row rather than a sibling island above the `Host`, so the calendar **scrolls with the page**
instead of pinning above it. **The price is real and accepted: the open/close animates a height, so
every frame of that spring crosses the bridge as an intrinsic-size invalidation on the row.** It
measures smooth on device today. If the open/close ever starts to stutter, that is the first place
to look, and the escape hatch is moving the calendar back out to a sibling island above the `Host`
— which costs the scroll behaviour, so it is a decision, not a tidy-up.

**One animated layout property in the app, and this is it.** The container's `height` is animated
because the list below has to be _pushed down_ by the opening month, and a transform cannot push
anything — it would slide the calendar over the rows instead of moving them. Everything else in the
island animates `transform` or `opacity`, which composite without touching layout. Nothing else may
animate layout;
[features/calendar/hooks/use-expansion.ts](../../features/calendar/hooks/use-expansion.ts)
carries the reasoning beside the one exception.

**Virtualization does not belong inside an animating clip.** A horizontal paged `FlashList` was the
obvious choice for the two pagers and was measurably the wrong one: it lives inside a clip that is a
single week row tall while collapsed, so it measured that viewport, virtualized nearly everything
out of it, and then re-measured on every frame of the opening spring. QA caught all three
consequences on device — an initial scroll landing on the wrong page, a settle handler reading an
offset one page stale, and the grid going blank for ~430ms mid-collapse. Three fixed pages
(previous, current, next, recentred on settle) replaced it, and bought nothing back: a month page is
42 cells, well below the size at which recycling pays for itself. See
[features/calendar/components/pager.tsx](../../features/calendar/components/pager.tsx) before
reintroducing a list there.

## Hit testing and accessibility

**A SwiftUI `Menu` hit-tests and labels its `label` view, not the `Menu`.** Modifiers on the `Menu`
reach the menu _container_ and silently do nothing to the interactive part. This bit twice on the
create button before it became a native view: first with `accessibilityLabel`, which produced two
accessibility nodes, one of them a stray full-screen element; then with `contentShape`, which had no
effect at all (measured). Anything concerning **hit area, accessibility or the appearance of the
control itself** goes on the leaf inside `label`; only appearance of the container belongs on the
`Menu`.

Related, and the reason that pair of findings is worth keeping: a glyph is only as tappable as it is
large. Pair `frame(...)` with `contentShape(...)` **on the label, in that order** — `frame` alone is
not enough, because hit-testing follows drawn content rather than layout bounds. A 24pt glyph centred
in a 60pt circle otherwise leaves an 18pt dead ring and fails Apple's 44pt minimum target.

**No `@expo/ui` `Menu` exists in the app today.** The create menu was the last one and is now the
native dock ([navigation.md](navigation.md)); the only menu still on screen is the
`Stack.Toolbar.Menu` in [app/(private)/exercises/index.tsx](<../../app/(private)/exercises/index.tsx>),
which is Expo Router's toolbar API and a different thing. Both rules above are recorded findings to
apply if a SwiftUI `Menu` comes back, not descriptions of live code. Hit testing inside the native
dock follows a different set of rules —
[Pass-through hit testing](#pass-through-hit-testing) above.

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

**Motion ownership follows the tree, and the two owners are not interchangeable.** Inside a `Host`,
motion is SwiftUI's: Reanimated cannot reach in to animate SwiftUI content, so it is not the tool for
the `List`-based screens, and where a transition already exists natively — a `DisclosureGroup`'s
chevron rotation and reveal — use it, since UIKit's own animation cannot desync from a recycled row
the way a `useAnimatedStyle` pair could. Inside a plain React Native island, motion is **Reanimated's**
— the calendar's open/close is the app's only example, and `@expo/ui`'s modifiers are not available
to it at all.

Two different engines, then, and the difference that bites is Reduce Motion: Reanimated honours it
automatically and `@expo/ui` does not. Both halves are spelled out below.

Numbers that change in place use `contentTransition('numericText')` plus `animation(...)`, both
applied **outermost**, after `font` and `monospacedDigit`. `contentTransition` alone never runs:
`animation` supplies the transaction that drives it. Animate only values that genuinely mutate in
place — a logged workout's duration is immutable and gains nothing. Keep durations at or under
300ms; the Activity counters use 250ms ease-in-out, against Apple's `Animation.default` of roughly
350ms, which reads as draggy on a three-row stat block. That cap is about a value changing in place;
the one recorded exception is the dock's modal presentation, argued in
[Native motion](#native-motion) above.

**SwiftUI does not honour Reduce Motion for you.** `@expo/ui`'s `animation` modifier is a thin
pass-through to `.animation(_:value:)` with no accessibility check
(`AnimationModifier` in `node_modules/@expo/ui/ios/Modifiers/ViewModifierRegistry.swift`), and the
SwiftUI environment value cannot be read from JS. Gate on
[hooks/use-reduce-motion.ts](../../hooks/use-reduce-motion.ts) and **drop the motion modifiers
entirely** rather than animating to zero duration. UIKit is no different — the native dock reads the
same hook, as [Native motion](#native-motion) records.

**Reanimated does honour it, and that is why the calendar has no branch.** Left unset, a
`withSpring` or `withTiming` config defaults to `ReduceMotion.System`, under which the animation
jumps straight to its target whenever the OS setting is on. So the calendar opens and closes
instantly, correctly, with no `useReducedMotion()` check in the hook and none in any component —
see the `reduceMotion`-is-deliberately-absent note in
[features/calendar/hooks/use-expansion.ts](../../features/calendar/hooks/use-expansion.ts).
**Do not import `useReduceMotion()` into a Reanimated island.** That hook exists for the two engines
that have no check of their own; using it on this side reintroduces by hand a branch Reanimated
already takes, and a hand-written branch can be wrong. (Testers: iOS applies a Reduce Motion change
to a running app only after a relaunch.)

Gate on loading state as well. `.animation(_:value:)` never animates the first time it is applied, so
introducing it at the moment redaction lifts is what stops placeholder figures from visibly rolling
into the real ones — see `counterModifiers` in
[features/home/home-content.tsx](../../features/home/home-content.tsx), which returns the static base
array whenever the stores are loading or Reduce Motion is on, leaving the redacted modifier arrays
byte-identical to what they were before.
