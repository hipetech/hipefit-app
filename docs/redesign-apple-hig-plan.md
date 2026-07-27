# Redesign plan: full Apple-native look

Target: Hipefit reads as an app Apple could have shipped — indistinguishable in styling
from Fitness / Health / Journal. iOS only.

## Decisions (locked with the user, 2026-07-27)

| Decision       | Choice                                                                      |
| -------------- | --------------------------------------------------------------------------- |
| Brand accent   | **Dropped.** No custom purple. System tint (no `seedColor` at all).         |
| Platform scope | **iOS only.** `.android.tsx` fallbacks stay as-is, but must keep compiling. |
| Typography     | Free to change. Target Apple text styles + Dynamic Type.                    |
| Figma mockups  | **Structure only, not styling** — see §9.                                   |

## Inputs

1. **Live QA pass** on iPhone 17 Pro / iOS 26.5 — 14 captures in `scratchpad/qa-screens/`.
   App signed in; Home, Workouts, Exercises (list, expanded card, detail sheet), Settings
   and Edit Profile all reached.
2. **Source audit** against `expo-native-ui`, `expo-ui`, `expo-router` skills, cross-checked
   against the installed `.d.ts` files in `node_modules` (which `expo-ui` names as the most
   reliable source of truth). Cited _[skill]_ / _[d.ts]_ below.
3. **Figma `HipeFit`** (`bXRKY3ueO3Bg31zmuSvxX2`) — **not read**; MCP unauthenticated. Per
   AGENTS.md it is competitor research (Hevy / Strong / GYM Keeper), raster-only.

---

## The one change that fixes most of this

Every screen is a `ScrollView` of hand-rolled `Card` surfaces, each in its own `Host`.
HIG's grouped-list idiom appears nowhere. Replacing the card stacks with a single SwiftUI
`List` + `Section` + `listStyle('insetGrouped')` island per screen collapses ~13 live Hosts
on Home to 1, and delivers for free: 16pt margins, 44pt minimum row heights, inset hairline
separators, `systemGroupedBackground`, swipe actions, selection highlighting — **and it
fixes bugs 0.2 and 0.3a structurally rather than by workaround.**

`List`, `Section`, `SwipeActions`, `ContextMenu`, `listStyle`, `listRowBackground`,
`listRowInsets`, `listSectionSpacing`, `headerProminence`, `badge` are all confirmed
present in `node_modules/@expo/ui/build/swift-ui/`.

---

## Phase 0 — Unblock (P0, precedes design work)

### ✅ RESOLVED 2026-07-27 — dark mode was never a code bug

Probe result: the account's stored `profile.settings.theme` is **`'light'`**, which pins the
app via `use-app-color-scheme.ts:16` → `_layout.tsx:32`. Causal isolation: changing that one
line to ignore the stored preference flipped the whole RN layer to correct dark. Confirmed
visually twice — the Theme picker now reads "Light", and on a fresh Metro reload (before the
profile loads) the app renders fully dark.

**`app/_layout.tsx` behaves exactly as designed; do not change it.** The fix is data — set
`settings.theme` to `'system'` on the account — plus 0.2, which is what stranded the user
there. Worth adding: nothing in `use-user-store.ts` writes a default `theme`, so a doc that
acquires `'light'` is sticky and, before 0.2, unrecoverable in-app.

### ⚠ NEW — RN and SwiftUI disagree on appearance

Surfaced while verifying the above. In dark mode the RN layer renders black correctly, but
the SwiftUI `Host` islands (`Card`, stat tiles) still paint light — see
`scratchpad/settings-cardfix4.png` / `cardfix5.png`. There are **two parallel appearance
paths**: `Appearance.setColorScheme` for the RN tree, and `colorScheme={useAppColorScheme()}`
threaded into every `Host`. They can disconnect.

This is the real reason the `colorScheme` threading is load-bearing (see "Architecture"
below). Resolve it during Phase 1.2 when the token layer is rewritten — the two paths should
collapse into one.

### 0.1 (historical) — candidates ruled out during diagnosis

Verified directly: `simctl` reports the simulator `dark`; the app renders fully light.
Confirmed on a live toggle _and_ a cold relaunch.

**Ruled out with evidence — do not re-investigate these:**

| Candidate                                          | Evidence it's clean                                                                                                         |
| -------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| `Appearance.setColorScheme('unspecified')` invalid | `react-native/Libraries/Utilities/Appearance.js:104` handles `'unspecified'` explicitly and re-reads `getColorScheme()`     |
| Info.plist forcing light                           | All three env plists are `Automatic` — `Info-dev.plist:76-77`, `Info-stage.plist:76-77`, `Info-prod.plist:76-77`            |
| Native window override                             | `ios/Hipefit/AppDelegate.swift` — zero occurrences of `overrideUserInterfaceStyle`                                          |
| `Host colorScheme={undefined}` wrong               | _[d.ts]_ `Host/types.d.ts:20-22`: _"omitted follows the device setting"_ — `undefined` is the correct "follow system" value |

**The probe that settles it** (~2 min, run with simulator in dark):

```tsx
import { Appearance, useColorScheme } from 'react-native';

console.log('useColorScheme:', useColorScheme());
console.log('Appearance.getColorScheme:', Appearance.getColorScheme());
```

- Both `'dark'` but UI light → bug is in **color resolution** (PlatformColor trait
  inheritance through `theme/colors.ts`).
- Either `'light'`/`null` → bug is in the **Appearance/native layer**; next step is to
  comment out `app/_layout.tsx:31-33` entirely and re-test.

Two live hypotheses remain: (a) the account's stored `profile.settings.theme` is `'light'`,
pinning the app — which also explains why 0.2 leaves the user stranded; (b) an ancestor view
is pinned to light, so every `Color.ios.*` token below resolves light. The _uniformly_ light
UI (RN text **and** SwiftUI cards) argues for something app-global, i.e. (a).

### 0.2 Theme setting invisible — ROOT CAUSE FOUND

`app/(private)/settings.tsx:199` wraps `FieldGroup` in `<Host matchContents>`.
_[d.ts]_ `FieldGroup.ios.d.ts:2-4`: _"A **scrollable** container… On iOS this wraps
SwiftUI's `Form`."_ A `Form` is a scroll container with **no intrinsic content height** —
it expands to fill offered space. `matchContents` sizes the RN view to intrinsic content
→ measures **0** → section invisible. The parent `ScrollView` (`settings.tsx:161`) is also
unbounded, so there's nothing to fill. And `matchContents` _"can only be set once on
mount"_ _[d.ts: types.d.ts:7-9]_, so it never recovers on a later pass.

- **✅ FIXED 2026-07-27, but NOT by the obvious hotfix.** Bounding the Host height _reserves_
  the space and still paints nothing — verified on device at both 100pt and 300pt. A SwiftUI
  `Form` nested inside an RN `ScrollView` does not lay out at all, at any height. The working
  fix was to drop `FieldGroup` entirely and render the rows with the `Card`/`Row` pattern
  already proven on this screen, with the width bounded in RN
  (`style={{ width: contentWidth }} matchContents={{ vertical: true }}`).
  **Generalized lesson: `FieldGroup`/`Form` is unusable inside a scroll view — it needs to be
  the root of a `flex: 1` Host.** That constraint shapes Phase 2.4.
- **Correct fix:** Phase 2.4. Settings becomes **one** `Host style={{ flex: 1 }}` (no
  `matchContents`) containing one `Form`/`List`, with profile / theme / stats / Log Out as
  `Section`s. 6 Hosts collapse to 1 and the bug cannot recur.

### 0.3 Layout defects

| Bug                                               | Location                                          | Fix                                                                                                                                                                                                                                                   |
| ------------------------------------------------- | ------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Segmented control clips "Advanced" off-screen     | `features/exercises/difficulty-filter.ios.tsx:21` | **Same root cause as 0.2** — unbounded `matchContents` lets SwiftUI request ideal width. The correct pattern already exists in this repo: `active-workout-banner.ios.tsx:17-20` uses `style={{ width }} matchContents={{ vertical: true }}`. Copy it. |
| Chip wraps mid-word                               | `ui/chip.ios.tsx:20-30`                           | No `lineLimit(1)`/`fixedSize`. `routine-card.ios.tsx:25` already does this correctly.                                                                                                                                                                 |
| Exercises title centered                          | `ui/text.tsx:19`                                  | The `h1` variant hardcodes `textAlign: 'center'`; `index.tsx:80` and `workouts.tsx:56` pass `textAlign: 'left'` to undo it, `exercises.tsx:129` forgets. **Variant designed wrong, not 3 call-site mistakes** — Phase 2.5 deletes it.                 |
| Sheet description truncated                       | `exercise-detail-sheet.ios.tsx:118`               | No explicit `lineLimit` → SwiftUI default truncation. Add `lineLimit(null)`.                                                                                                                                                                          |
| Exercise row has no `accessibilityLabel`/`testID` | `exercise-card.ios.tsx:68`                        | QA had to tap by coordinate. Fix early — makes every later QA pass cheaper.                                                                                                                                                                           |

**Project rule worth adopting:** `matchContents` on _both_ axes is only safe for content with
a genuine intrinsic size. Constrain the cross-axis in RN and match only the other.

---

## Phase 1 — Foundation (blocking, in this order)

> **Ordering note:** navigation comes _before_ tokens and typography. Titles currently live
> in screen bodies; once they move into headers, ~14 `ui/text.tsx` call sites disappear
> entirely. Restyling text that is about to be deleted is wasted work.

### 1.1 Navigation chrome — highest leverage, highest risk, do first

`app/(private)/_layout.tsx:6-37` renders `NativeTabs` over **flat route files**. No `Stack`
under any tab → no headers, no large titles, no search, no toolbars. Titles are body text
(`index.tsx:80`, `workouts.tsx:56`, `exercises.tsx:129`; Settings has none), and
`paddingTop: 60` (`workouts.tsx:163`, `exercises.tsx:35,127`) is a magic number standing in
for a nav bar.

_[skill]_ — _**"ALWAYS use a navigation stack title instead of a custom text element on the
page"**_, and _"When a route belongs to a Stack, its first child should almost always be a
ScrollView with `contentInsetAdjustmentBehavior="automatic"`."_

Convert each tab from a file to a folder with its own `Stack` (`index/`, `workouts/`,
`exercises/`, `settings/`, each `_layout.tsx` + `index.tsx`). Then:

```tsx
<ScrollView style={{ flex: 1 }} contentInsetAdjustmentBehavior="automatic">…</ScrollView>
<Stack.Screen.Title large>Workouts</Stack.Screen.Title>
<Stack.Toolbar placement="right">
  <Stack.Toolbar.Menu icon="plus">
    <Stack.Toolbar.MenuAction icon="figure.run">Start Workout</Stack.Toolbar.MenuAction>
    <Stack.Toolbar.MenuAction icon="list.bullet.rectangle">New Routine</Stack.Toolbar.MenuAction>
    <Stack.Toolbar.MenuAction icon="dumbbell">Custom Exercise</Stack.Toolbar.MenuAction>
  </Stack.Toolbar.Menu>
</Stack.Toolbar>
```

That menu is **the native home for the lost FAB** — absorb the outstanding follow-up here.
Exercises gets `<Stack.SearchBar>`, deleting the custom search at `exercises.tsx:136-165`.
Home should use a _non-large_ title — the greeting is content, not a title.

Keep NativeTabs: QA confirmed the tab bar already renders as genuine iOS 26 Liquid Glass
and is the most native thing in the app.

**Risk: high.** Moves 4 route files, changes the router tree; `typedRoutes: true`
(`app.config.js:8`) means `.expo/types` must regenerate. Route paths stay stable, so
`Redirect href="/(private)"` at `app/index.tsx:20` and `login.tsx:20` keeps working.

### 1.2 Colors — `theme/colors.ts`

Structurally already correct: `Color` from `expo-router` + `Platform.select`, exactly the
_[skill § Colors]_ pattern. **Zero hardcoded hex exists anywhere outside this file** — token
discipline is good. The gaps are the brand purple and an incomplete token set.

- **Delete** `brand: '#937DEF'` (`:79`), `brandForeground` (`:81`), `BRAND_SEED` (`:88`).
- **Add** (all confirmed in `expo-router/build/color/ios.types.d.ts`):
  `systemGroupedBackground`, `secondarySystemGroupedBackground`,
  `tertiarySystemGroupedBackground`, `quaternaryLabel`, `placeholderText`,
  `opaqueSeparator`, `systemFill`…`quaternarySystemFill`, `systemBlue`,
  `systemGray`…`systemGray6`, `systemGreen`, `systemOrange`.
- **Fix the web fallbacks** — the `default:` hexes (`:22,28,34,41,48,55,62,68`) are all
  dark-palette ports from the deleted `global.css`, and the header comment still claims the
  app is "dark-first (purple/lavender brand, hue 290)". Both now false. Low priority under
  iOS-only scope, but the comment actively misleads.
- **Grouped vs ungrouped surfaces:** `secondarySystemBackground` is the _ungrouped_ surface.
  Grouped screens need `systemGroupedBackground` (page) + `secondarySystemGroupedBackground`
  (rows). Affects `card.d.ts:12`, `exercises.tsx:108,160,173`, `exercise-card.ios.tsx:62`.
  **Re-test dark mode right after this lands** — it may interact with 0.1.

### 1.3 Strip the purple — ~36 sites

- **`seedColor` ×20:** `index.tsx:56,85,91,107,126,136,143,161,181` ·
  `settings.tsx:138,150,166,199,231,304` · `exercises.tsx:25` · `auth/index.tsx:77` ·
  `workouts/{chip-badge:13, workouts-skeleton:16, empty-card:24, routine-card:17,
active-workout-banner:19, workout-history-card:23}.ios.tsx` ·
  `exercises/{difficulty-filter.ios:21, difficulty-filter.android:18,
exercise-detail-sheet.ios:52, exercise-card.ios:87,173}`

  **Remove it, don't substitute.** _[d.ts]_ `Host/types.d.ts:29-38`: omitted → _"each
  platform falls back to its default theme"_ = the system accent on iOS. Setting
  `seedColor={colors.systemBlue}` would pin the tint and defeat the goal.

- **`colors.brand` as a real fill/tint ×12:** `_layout.tsx:7` (NativeTabs `tintColor` — drop)
  · `settings.tsx:207` (give each row its own semantic glyph color, Settings-app idiom, not
  one purple) · `avatar.ios.tsx:37` → `systemFill` + `label` · `chip.ios.tsx:23,25` (map to
  _status_ colors: `systemGreen` completed / `systemOrange` in-progress) · `card.ios.tsx:25`
  · `exercise-detail-sheet.ios.tsx:110,140` · `exercise-card.ios.tsx:204` (drop
  `tint(colors.brand)` — unmodified `borderedProminent` already uses the accent) ·
  `fallback-button.tsx:30,32,39`
- Also drop `tint(colors.label)` at `exercise-card.ios.tsx:150` — a black/white progress bar
  reads as broken.

> **⚠ Android blast radius — must be one atomic commit.** Deleting `colors.brand` breaks
> `chip.android.tsx:18,26`, `avatar.android.tsx:27,34`, `card.android.tsx:14`,
> `fallback-button.tsx:30,32,39`, `exercise-card.android.tsx:177,181`,
> `exercise-detail-sheet.android.tsx:113,117`. These are **typecheck** failures, not runtime.
> Cheapest fix: add an `accent` token → `Color.android.dynamic.primary`.

---

## Phase 2 — The look

### 2.4 `List`/`Section`/`insetGrouped` migration — Settings → Workouts → Home → Exercises

The core of the redesign. Fixes §c/§d/§h below and permanently retires the 0.2 / 0.3a
hotfixes.

| Today                                                                                    | Should be                                                                                                                                                                                                                                                           |
| ---------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ui/card.*` custom `VStack`+`background`+`cornerRadius` (`card.ios.tsx:29-44`), 10 files | `List`/`Section` rows + `listRowBackground`/`listRowInsets`                                                                                                                                                                                                         |
| `workouts.tsx:116-122` hand-drawn divider                                                | `Section` boundary                                                                                                                                                                                                                                                  |
| `settings.tsx:255,277` vertical separators between stat columns                          | `List` rows + `badge()` trailing values                                                                                                                                                                                                                             |
| `exercises.tsx:150-164` RN `TextInput` + absolutely-positioned `SymbolView`              | `Stack.SearchBar` (native, hides on scroll, free Cancel)                                                                                                                                                                                                            |
| `exercises.tsx:168-187` segmented Picker in a hand-drawn labeled card                    | `Stack.Toolbar.Menu` filter, or Section-header picker                                                                                                                                                                                                               |
| `exercise-card.ios.tsx:50-54,155-161,164-212` Reanimated chevron + FadeIn/Out            | SwiftUI `DisclosureGroup` — native animation, no Reanimated, no `LegendList` recycling risk                                                                                                                                                                         |
| No delete/edit anywhere                                                                  | `SwipeActions` + `.Actions`                                                                                                                                                                                                                                         |
| `settings.tsx:320-350` Log Out `BottomSheet`                                             | `ConfirmationDialog`/`Alert` — a destructive confirm is an alert on iOS, not a sheet                                                                                                                                                                                |
| `settings.tsx:353-380` Edit Profile `BottomSheet`                                        | Pushed `Form` screen or `presentation: 'formSheet'`                                                                                                                                                                                                                 |
| `settings.tsx:333-339` `TextInput` with `defaultValue` + remount `key` hack (`:335`)     | `useNativeState` + `ObservableState` — _[expo-ui references/universal.md § TextInput]_: value _"must take an `ObservableState` object… not a plain string."_ `react-native-worklets@0.10.0` is already installed; the `key` hack is a workaround for using it wrong |
| `ui/skeleton.*`                                                                          | SwiftUI `redacted` modifier; `ContentUnavailableView` for empty states                                                                                                                                                                                              |

**Spacing cleanup falls out of this.** Every metric is currently hand-rolled: `H_PADDING = 20`
(`index.tsx:21`) vs HIG 16 · `paddingTop: insets.top + 20` (`index.tsx:45`) · `gap: 32`
(`index.tsx:48`) vs `List`'s automatic 35pt section spacing · `card.d.ts:6-9` padding 16 /
spacing 12 / radius 16 vs `insetGrouped`'s 16 lead / 11 vert / radius 10. Fragile width math
at `index.tsx:33-34`, `settings.tsx:75-76`, `workouts.tsx:33`, `exercises.tsx:23`,
`exercise-detail-sheet.ios.tsx:46` — all of it Host-sizing workarounds that `List` deletes.

_[skill § Responsiveness]_ requires `contentInsetAdjustmentBehavior="automatic"` on scroll
containers, _"applied to FlatList and SectionList as well."_ Only `settings.tsx:134,161` has
it; `index.tsx:52,67`, `workouts.tsx:146,160`, `exercises.tsx:31` omit it and compensate with
`useSafeAreaInsets()` + magic padding — the exact anti-pattern the skill names. Delete
`useSafeAreaInsets()` at `index.tsx:30` and `workouts.tsx:31`.

_[skill § General Styling]_ requires `{ borderCurve: 'continuous' }` — **zero occurrences
today**. Every RN rounded rect (`exercise-card.ios.tsx:64,78`, `exercises.tsx:106,159,171`,
`progress.tsx:27`, `fallback-button.tsx:29`) uses circular corners, visibly non-Apple beside
real SwiftUI surfaces.

### 2.5 Typography — `ui/text.tsx`

A **shadcn/Tailwind prose scale ported verbatim**. `h1` (`:14`) is 36pt/800/centered vs
Apple `largeTitle` 34pt/leading-aligned. `h2` (`:21`) carries a Markdown `borderBottomWidth`
rule. `blockquote`/`code`/`p` (`:42-63`) are dead web variants; `p`'s `marginTop` violates
_[skill]_ _"prefer flex gap over margin and padding."_ `small` (`:73`) has
`lineHeight === fontSize` → clipped descenders.

**Dynamic Type is effectively off app-wide.** Exactly one file uses a text style
(`exercise-detail-sheet.ios.tsx:76`); ~45 other SwiftUI `Text` sites use fixed
`font({ size: N })`, plus raw `fontSize` at `settings.tsx:176,180,240,246,311,325,332,358,373`.
_[d.ts]_ `swift-ui/modifiers/index.d.ts:952`: _"Pass `textStyle` to scale with the user's
Dynamic Type setting"_; union at `:985` is `largeTitle | title | title2 | title3 | headline |
subheadline | body | callout | footnote | caption | caption2`.

Font _family_ needs no work — RN already defaults to SF Pro on iOS. Rewrite the variants to
Apple's 11 styles 1:1 with that union so RN and SwiftUI share one vocabulary. Delete the web
variants and the `ROLE`/`ARIA_LEVEL` maps (`:86-100`) — iOS-only now. Then swap ~45
`font({ size })` → `font({ textStyle })`.

Breaks 14 call sites (`index.tsx:80,83,102,154`, `workouts.tsx:56,59,83,125`,
`exercises.tsx:111,129,132,177`, `settings.tsx:220`, `auth/index.tsx:48,69`) — **most vanish
anyway once 1.1 moves titles into headers.** Large but mechanical.

Also _[skill]_: `selectable` on data-bearing text; `fontVariant: 'tabular-nums'` (SwiftUI:
`monospacedDigit`) on the stat counters at `native.ios.tsx:35` and
`settings.tsx:240,262,284` — they currently jitter as values change.

---

## Phase 3 — Native feel

- **Haptics — installed, zero usages.** _[skill § Behavior]_. `selectionAsync()` on
  difficulty change (`exercises.tsx:77-86`) and card expand/collapse; `impactAsync(Light)`
  on tap-through to detail; `notificationAsync(Success)` on workout completion / profile
  save (`settings.tsx:92-95`). Per _[references/controls.md]_, `Switch` and `DateTimePicker`
  have built-in haptics — **no** extra haptic on the theme Picker.
- **Motion:** `entering`/`exiting`/`layout={LinearTransition}` on list rows; staggered
  `FadeInUp.delay(index * 50)`. Keep ≤300ms.
  > **Trap:** _[references/animations.md]_ — you cannot pass `Color`/`PlatformColor` values
  > into Reanimated styles. **Every `theme/colors.ts` token is a PlatformColor on iOS.**
  > Use static colors in animated styles; worth a code comment.
- **Glass — installed, zero usages.** Best fit: a persistent "workout in progress" pill
  above the tab bar via `GlassView isInteractive`; today that state is a static
  `Card bordered` (`active-workout-banner.ios.tsx:22`). Gate on `isLiquidGlassAvailable()`.
  Note `expo-blur` is **not** installed, so the documented fallback is currently
  unimplementable — either install it or fall back to solid
  `secondarySystemGroupedBackground`.

---

## Phase 4 — Cleanup

**Dependencies — verified zero usages across the whole repo, safe to remove:**
`lucide-react-native`, `@expo/vector-icons`, `react-native-svg` (lucide peer),
`@gorhom/bottom-sheet` (superseded by `@expo/ui` `BottomSheet`), `expo-font`.

**Iconography is already good — mostly leave alone.** `expo-symbols` `SymbolView`
(`exercises.tsx:144-148`, `exercise-card.ios.tsx:156-160`), `@expo/ui` `Icon` typed via
`sf-symbols-typescript` (`settings.tsx:1,125,207`), and `NativeTabs.Trigger.Icon
sf={{default, selected}}` (`_layout.tsx:9-34`) all follow the `.fill`-when-selected pattern.

> **Documented discrepancy — flagged so nobody "fixes" it later.** `SKILL.md § Library
Preferences` says _"expo-image with `source="sf:name"` … not expo-symbols"_, but the
> skill's own `references/icons.md` documents `SymbolView` throughout, including animations
> and weights. The codebase follows the reference doc. **Keep `expo-symbols`** — installed,
> used correctly, fully documented. Not worth churning.

**Other:**

- `tsconfig.json:19` — still lists the deleted `uniwind-types.d.ts`. One-line delete.
- `components.json` — dead shadcn config; all three aliases point at deleted paths. Delete
  the file.
- `ui/progress.tsx` — **keep.** It has 2 live consumers, both Android
  (`exercise-card.android.tsx:15`, `exercise-detail-sheet.android.tsx:9`). On iOS, prefer
  SwiftUI `ProgressView`, but deleting the file breaks the Android typecheck.
- Xcode warning: `Info-dev.plist` incorrectly in Copy Bundle Resources — pre-existing,
  trivial.

---

## Architecture: what the real violation is

**Correction to an earlier reading.** The route files do **not** violate the
platform-isolation rule as first described — `index.tsx:2`, `settings.tsx:16`,
`exercises.tsx:4` import only from the **universal** `@expo/ui` root (`Host`, `Button`,
`Icon`, `ListItem`, `FieldGroup`, `Picker`, `BottomSheet`, `Column`, `Row`, `Text`), which is
legal on both platforms. Host counts are also lower than first stated: **9** JSX sites in
`index.tsx`, **6** in `settings.tsx`, **1** in `exercises.tsx`.

**The real violation is different and worse.** `settings.tsx:138-149,150-154,166-196,231-301`
puts a universal `<Host>` (→ a **Compose** Host on Android) directly around `<Card>`,
`<Skeleton>`, `<Avatar>`, `<Separator>` — all platform-split, and whose `.android.tsx`
variants are **bare RN `View`s** (`card.android.tsx:18`, `skeleton.android.tsx:8`,
`separator.android.tsx:11`). AGENTS.md: _"the Android variant must NOT use a `Host` — bare RN
primitives can't nest inside a Compose `Host`."_ Same pattern at `index.tsx:56-61` and
`exercises.tsx:25-28`.

`workouts.tsx` is the correct model — **zero** `<Host>` in the route file; every native
surface delegated to a platform-split island owning its own Host on iOS and returning
Host-less RN on Android.

**Fix:** extract `features/home/home-content.{ios,android}.tsx`,
`features/settings/settings-content.{ios,android}.tsx`,
`features/exercises/exercises-skeleton.{ios,android}.tsx` on the `workouts.tsx` pattern.
Falls out naturally from 2.4 — each screen becomes one island with one Host, in `features/`.

**Nested Hosts:** no real violations. `settings.tsx:318-319` correctly documents that
`BottomSheet` supplies its own Host; `exercise-card.ios.tsx:84,171` are siblings, not nested.
One inconsistency to resolve: `exercise-detail-sheet.ios.tsx:49-54` wraps `BottomSheet` in a
Host while `settings.tsx` deliberately does not. Verify against SDK 57 before touching either.

**`colorScheme` prop threading — do NOT delete yet.** `useAppColorScheme()` is threaded as an
explicit prop through 7 island components and called directly in 6 more files. It _looks_
redundant given `Appearance.setColorScheme` at `_layout.tsx:32`. **Given 0.1 is unresolved,
treat this as load-bearing until dark mode is fixed** — it may be the only thing that would
make forced light/dark work at all. Revisit after 0.1 closes.

---

## §9 Figma reference — structure only

Not opened (MCP unauthenticated), and per AGENTS.md:114 it _cannot_ change any styling
recommendation: raster-only, no components/variables/styles, `@/theme/colors` remains the
sole token source. Nothing above derives from it.

Where competitor **structure** legitimately matters: the captured flows name screens Hipefit
lacks — Onboarding, New Routine, Log Workout, Workout Settings, New Program. Don't invent
them now, but note **1.1 is what makes them cheap later**: once each tab has a `Stack`, "New
Routine" is a pushed route or a `formSheet`, and `Stack.Toolbar.Menu` is already its entry
point. If those references argue for denser exercise rows than today's 140pt image card
(`exercise-card.ios.tsx:78`), that is a _structural_ argument for the `List` +
`DisclosureGroup` change already recommended.

**Do not port** any color, radius, shadow, typeface, badge shape, or tab-bar treatment — all
three apps use custom brand palettes, exactly what this redesign removes.

---

## Sequencing and risk

```
Phase 0 ──► 1.1 nav ──► 1.2 colors ──► 1.3 strip purple ──► 2.4 List ──► 2.5 type ──► 3 ──► 4
(unblock)   (high risk)  (atomic w/ Android)                (large)      (mechanical)
```

| Risk                                        | Severity                         | Mitigation                                                                                            |
| ------------------------------------------- | -------------------------------- | ----------------------------------------------------------------------------------------------------- |
| Dark mode cause still unknown               | **High — gates sign-off on 1.2** | Run the 0.1 probe first; timebox. If unresolved, ship light-only and treat dark as its own workstream |
| 1.1 rewrites the router tree                | High                             | `typedRoutes` regen; route paths stay stable so redirects keep working                                |
| 1.3 breaks Android typecheck across 6 files | Medium                           | **One atomic commit**, or add an `accent` token first                                                 |
| 2.4 touches 4 screens + 10 island files     | High                             | Screen-by-screen: Settings → Workouts → Home → Exercises                                              |
| 2.5 touches ~59 call sites                  | Medium                           | Mechanical; do after 1.1 so ~14 sites are already gone                                                |

## Before starting

The `@expo/ui` migration (~48 changed/new files) is **uncommitted on `main`** and now
verified to build and run. **Branch and commit it first.** A redesign layered on an
uncommitted migration is unrecoverable if it goes wrong.
