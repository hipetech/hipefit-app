---
type: plan
status: active
area: calendar
created: 2026-08-12
---

# Plan: rebuild the weekly calendar on Flash Calendar and Reanimated 4

## Outcome

`features/calendar/` renders the same expandable weekly calendar it renders today, with the same
public contract, but with Wix `react-native-calendars` replaced by
[`@marceloterreiro/flash-calendar`](https://marceloprado.github.io/flash-calendar/) for calendar
data and `react-native-reanimated` for the expand/collapse motion. Home is untouched apart from a
stale comment.

The vendor swap is invisible to every call site:
[`types.ts`](../../../features/calendar/types.ts) does not change, and
[`home-calendar-mocks.ts`](../../../features/home/home-calendar-mocks.ts) does not change. When this
lands, `react-native-calendars` is gone from [`package.json`](../../../package.json), the
version-pinned vendor-internals module `calendar-theme.ts` is deleted, and the calendar's geometry,
motion, and accessibility are the app's own.

This plan supersedes the engine decision in
[`plans/weekly-calendar/plan.md`](../weekly-calendar/plan.md). That plan is historical input: its
contract, its Home layout reasoning, and its runtime acceptance matrix all still hold; only its
choice of interaction engine is replaced. Its unfinished Phase 3 is absorbed here, because the
durable documentation it promised was never written.

## Context

Read [`ui.md`](../../app/ui.md) before touching anything visible. Nothing in
[`ui.md`](../../app/ui.md) or [`architecture.md`](../../app/architecture.md) currently mentions the
calendar at all, and no `docs/flows/` document covers it — grep confirms it. The shipped calendar is
therefore **undocumented durable behavior**, which rule 2 of [`docs/README.md`](../../README.md)
calls a bug. Closing that is part of this initiative, not a nice-to-have.

### Why replace a working implementation

The Wix implementation works, and every workaround in it is documented. The cost is that the
workarounds exist at all, and all of them are pinned to `react-native-calendars@1.1314.0`:

- `calendar-theme.ts` reaches into three undocumented internal stylesheet shapes
  (`'stylesheet.calendar.main'`, `stylesheet.expandable.main`, `'stylesheet.calendar-list.main'`),
  two of which are absent from the library's own exported `Theme` type and are assembled with
  `Object.assign` to dodge TypeScript's excess-property check.
- `CALENDAR_WEEK_HEIGHT = 46` is a module constant read off `src/expandableCalendar/index.js`. It
  has no prop or theme override, so the day cell is sized to the vendor rather than the design, and
  `CALENDAR_DAY_NUMBER_MAX_SCALE` exists only to stop Dynamic Type from clipping the last week row
  against it.
- `isMonthGridDay()` in `components/day.tsx` distinguishes the week strip from the month grid by
  **string-matching the test ID Wix derives for each cell**, because both trees are mounted at once
  and nothing else tells them apart.
- Wix renders its own day numbers and weekday names with `allowFontScaling={false}`, so every
  visible piece had to be replaced rather than themed.
- **Reduce Motion was never resolved.** Phase 0 of the previous plan recorded it as an open gate:
  Wix springs open and closed unconditionally, and no patch or accepted exception was agreed. The
  calendar ships today in contradiction with [`ui.md`](../../app/ui.md#motion).

### What the replacement is actually made of

Flash Calendar is **not** a drop-in for `ExpandableCalendar`. It has no expandable mode, no week
strip, and no vertical open/close. What it has is the part that is tedious and easy to get wrong:

| Export                          | What it gives us                                                                                                                      |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| `useCalendar` / `buildCalendar` | `weeksList: CalendarDayMetadata[][]` for one month, plus `weekDaysList` and `calendarRowMonth`. Pure — returns data, renders nothing. |
| `useCalendarList`               | `monthList`, `initialMonthIndex`, `appendMonths`, `prependMonths`, `addMissingMonths`. Pure windowing for an infinite month pager.    |
| `toDateId` / `fromDateId`       | Local-midnight `YYYY-MM-DD` conversion, the same semantics `toLocalDateId` in [`format.ts`](../../../lib/format.ts) already defines.  |
| `CalendarDayMetadata`           | Per-day `id`, `date`, `displayLabel`, `isToday`, `isDifferentMonth`, `isStartOfWeek`, `isWeekend`, `isEndOfMonth`.                    |

Everything Flash Calendar renders is deliberately **not** used: no `Calendar`, no `Calendar.List`,
no `Calendar.Item.Day`, no `CalendarTheme`, no `useDateRange`, no `activeDateRangesEmitter`. Two
reasons. The app already owns every visible piece — Dynamic Type, semantic UIKit colors, one
44pt VoiceOver element per day — and re-deriving that through a vendor theme would recreate exactly
the translation layer this plan deletes. And Flash Calendar routes active-range state through a
**global `mitt` emitter** keyed by `calendarInstanceId`, which is a second source of truth for
selection that the controlled `selectedDateId` contract explicitly refuses.

So the trade is: the vendor supplies **date arithmetic and windowing**, and the app supplies
**pixels, motion, and semantics**. That is the boundary `calendar-theme.ts` failed to hold.

### Dependencies

| Change                                    | Note                                                                                                                                              |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| `+ @marceloterreiro/flash-calendar@2.0.0` | Exact pin. One transitive dep, `mitt` (~200 B).                                                                                                   |
| `+ @shopify/flash-list@2.3.2`             | Exact pin. Declared peer (`>=2.0.0`); Flash Calendar's bundle imports it statically, so it is required even though we do not use `Calendar.List`. |
| `- react-native-calendars@1.1314.0`       | Sole consumer is `features/calendar/`.                                                                                                            |

**No `pod install`, no `ios/Podfile.lock` change, no dev-client rebuild.** Verified against the
published tarballs: `@shopify/flash-list@2.3.2` ships `dist/`, `src/`, and `jestSetup.js` and has
**no podspec and no `ios/`/`android/` directory** — v2 is pure JavaScript on the New Architecture.
`@marceloterreiro/flash-calendar` is JavaScript. Re-verify this after any version bump before
assuming a JS-only install.

Reanimated is already installed and wired: `react-native-reanimated@4.5.0`,
`react-native-worklets@0.10.0`, `react-native-gesture-handler@2.32.0`, pods present in
[`Podfile.lock`](../../../ios/Podfile.lock), `react-native-worklets/plugin` in
[`babel.config.js`](../../../babel.config.js), and `GestureHandlerRootView` already wrapping the app
in [`_layout.tsx`](../../../app/_layout.tsx). This initiative adds no native surface at all.

## Approach

### Decisions taken before planning

Four were settled with the user and are not open:

1. **One clipped surface, not a cross-fade.** The week↔month transition is a clip over a single
   month grid, not two views fading into each other.
2. **Button, not drag.** The chevron toggle stays. No `Gesture.Pan` is added. The calendar is an
   `RNHostView` row inside a scrolling SwiftUI `List`, and Gesture Handler cannot negotiate a
   vertical drag with a `UIScrollView` across the bridge — the reason the button exists today.
3. **Pure swap.** The public contract, Home's mock markers, and Firestore's absence are unchanged.
   No `Timestamp` → local-date-ID adapter.
4. **Placement unchanged.** The calendar stays an `RNHostView matchContents` row inside the SwiftUI
   `List`, so it scrolls with the page and the large title still collapses.

### The clip

One shared value, `expansion`, moving `0 → 1`.

```
collapsed (expansion = 0)          expanded (expansion = 1)
┌────────────────────────┐         ┌────────────────────────┐
│ S  M  T  W  T  F  S    │         │ S  M  T  W  T  F  S    │
│ 3  4  5 (6) 7  8  9    │ ◀─clip  │ .  .  1  2  3  4  5    │
└────────────────────────┘         │ 6  7  8  9 10 11 12    │
                                   │ …                      │
height     = ROW_H → monthHeight   └────────────────────────┘
translateY = -weekIndex*ROW_H → 0
rowOpacity = 0 → 1  (rows other than the active week)
```

The outer `Animated.View` has `overflow: 'hidden'` and an animated `height`; the inner grid has an
animated `translateY` so the active week stays put while the month grows around it. Rows other than
the active week fade with `opacity`, which is a fast-path property and stops the clipped rows from
appearing to slide.

Animating `height` forces a layout pass every frame, and here it also crosses the bridge as an
`RNHostView` size invalidation every frame. That is a deliberate, already-proven cost: it is exactly
what the Wix implementation does today, and the note in
[`index.tsx`](../../../features/calendar/index.tsx)
records it as smooth on an iPhone 17 Pro. Phase 0 re-measures it rather than assuming it.

### Paging

A single horizontal, paged `FlashList`. **Its data granularity swaps with the expansion state**, so
there is one pager rather than two:

| State     | `data`                             | `renderItem`            | A swipe advances |
| --------- | ---------------------------------- | ----------------------- | ---------------- |
| Collapsed | week list                          | one `CalendarWeekRow`   | one week         |
| Expanded  | `monthList` from `useCalendarList` | one `CalendarMonthPage` | one month        |

The swap happens only **at rest**, never during the animation, and the visible week row is
pixel-identical on both sides of it, so it cannot be seen. During the open/close animation the pager
always holds month data and is clipped.

This is what makes "one clipped surface" and "collapsed swipes page by week" compatible. They are
otherwise in tension: weeks inside a month grid are stacked _vertically_, so no amount of clipping
lets a horizontal swipe advance one week. The alternatives were to let a collapsed swipe page by
month — a behavior regression against what ships — or to stack two pagers and swap their opacity,
which is the cross-fade that was rejected.

**Fallback, if the spike says otherwise.** If swapping `data` cannot restore the scroll offset in
the same commit without a visible flash, stack two pagers at identical geometry and swap
`opacity`/`pointerEvents` at rest — still not an animated cross-fade, because the handoff happens at
a resting state where both render the same row. If `FlashList` itself misbehaves as a paged
horizontal pager, replace it with a three-page rolling window (`prev`/`current`/`next`, recentred on
settle) in a plain `Animated.ScrollView`; a month page is 42 cells, so virtualization is a
convenience here, not a requirement. Record whichever is used and why.

### Reduce Motion comes for free

This is the concrete accessibility win, and it is why the motion layer is worth the rewrite. Under
Reanimated's default `ReduceMotion.System`, `withSpring` and `withTiming` **jump straight to
`toValue`** when the system setting is on. The calendar opens and closes instantly, correctly, with
no patch, no `useReducedMotion` branch in the component, and no documented exception — closing the
gate the previous plan left open. The app-wide `useReduceMotion()` hook stays where it is; it exists
for `@expo/ui`'s SwiftUI `animation` modifier, which has no such check.

### Reanimated rules that apply here

- **`runOnJS` does not exist in Reanimated 4.** Reconciling React state from a `withSpring`
  completion callback uses `scheduleOnRN(fn, ...args)` from `react-native-worklets`.
- Do not read `sharedValue.value` during render or in an effect. `useDerivedValue` and
  `useAnimatedStyle` only.
- Memoize the animated style inputs; `useAnimatedStyle` closures capture on every render otherwise.
- Prefer `transform` and `opacity` to layout properties. The one animated `height` is the
  documented exception above; nothing else may animate layout.

### What each file becomes

| File                           | Change                                                                                                                                                                                                                                                                                                                 |
| ------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `types.ts`                     | **Unchanged.** The proof the swap is invisible.                                                                                                                                                                                                                                                                        |
| `components/marker-dots.tsx`   | **Unchanged.**                                                                                                                                                                                                                                                                                                         |
| `components/month-header.tsx`  | Body unchanged; its doc comment is rewritten — it currently explains a Wix `onHeaderLayout` measurement bug that no longer exists.                                                                                                                                                                                     |
| `helpers/day-context.ts`       | Kept — `FlashList` memoizes rows, so context is still how selection and markers reach a cell without prop-drilling. Wix-specific rationale rewritten.                                                                                                                                                                  |
| `helpers/dates.ts`             | `parseDateId` → `fromDateId`. `getWeekdayLabels` → `weekDaysList` from `useCalendar` with `getCalendarWeekDayFormat` supplying the device locale, which deletes the hand-rolled Wix-`LocaleConfig` workaround. `describeCalendarDay`, `isTodayDateId`, `toMarkersByDateId`, `formatCalendarMonth` keep their behavior. |
| `helpers/metrics.ts`           | Rewritten. The numbers stop being vendor readings and become the design's own. `CALENDAR_WEEK_HEIGHT` is no longer Wix's 46.                                                                                                                                                                                           |
| `components/day.tsx`           | Props change from Wix `DateData`/`DayState`/`testID` to `CalendarDayMetadata` plus an explicit `isOutsideMonth` boolean. **`isMonthGridDay()` and its test-ID string-sniffing are deleted** — the week row simply never passes the flag.                                                                               |
| `components/expand-toggle.tsx` | Chevron rotation driven from the `expansion` shared value instead of two static transform styles, so it turns _with_ the height rather than snapping.                                                                                                                                                                  |
| `calendar-theme.ts`            | **Deleted.** `CALENDAR_TEST_ID` moves to `helpers/metrics.ts`.                                                                                                                                                                                                                                                         |
| `components/week-row.tsx`      | **New.** Seven `CalendarDay` cells from one `CalendarDayMetadata[]`.                                                                                                                                                                                                                                                   |
| `components/month-page.tsx`    | **New.** One month: N `CalendarWeekRow`s at viewport width, with per-row opacity driven by `expansion`.                                                                                                                                                                                                                |
| `components/pager.tsx`         | **New.** The horizontal paged `FlashList` and the granularity swap.                                                                                                                                                                                                                                                    |
| `hooks/use-expansion.ts`       | **New.** The shared value, spring config, derived styles, and the `scheduleOnRN` reconciliation back to React state.                                                                                                                                                                                                   |
| `index.tsx`                    | Rewritten as the orchestrator. Same props, same local state shape.                                                                                                                                                                                                                                                     |
| `home-content.tsx`             | Only the doc comment naming "Wix's animated open/close height". No code change.                                                                                                                                                                                                                                        |

### Restructured after the rewrite landed

The file table above names the flat layout the rewrite was built in. Once it was verified, the
feature was regrouped into `components/`, `helpers/` and `hooks/` behind an `index.tsx`, and the
`calendar-` filename prefix dropped — it had grown to fourteen files, twice the next largest
feature. Paths in this plan point at the new locations; the table's names are the historical ones.
[architecture.md](../../app/architecture.md#feature-based-organization) owns the rule and the
argument for when to copy it.

### Deliberately not changed

`CALENDAR_DAY_NUMBER_MAX_SCALE` **stays**, even though the reason for it changes: the cap existed
because Wix's fixed 46pt row would clip, and now it exists because the animation needs a row height
it can compute in JS without an `onLayout` round trip. Un-capping Dynamic Type means a measured row
height and is a real change in behavior, not a swap — see **Follow-up decisions**.

### Rejected alternatives

- **Keep Wix and only replace the motion with Reanimated.** The animation is the one part of the Wix
  integration that already works. The cost is the theme internals, the fixed week height, and the
  test-ID sniffing, none of which the motion layer touches.
- **Use `Calendar.List` as shipped.** Its scroll geometry (`getHeightForMonth`,
  `CalendarListRef.scrollToMonth`) is written for a vertical list; driving it horizontally means
  fighting offsets that were never meant to be horizontal. `useCalendarList` gives the same windowing
  as a pure hook with none of that.
- **Use Flash Calendar's `Calendar.Item.Day` and `CalendarTheme`.** Recreates the vendor-translation
  layer being deleted, and adds a global `mitt` emitter as a second source of truth for selection.
- **Drop `@shopify/flash-list` by importing only the pure helpers.** The published bundle imports
  `FlashList` statically at module scope, so Metro resolves it regardless of which export is used.
- **Add a drag gesture now that Gesture Handler is in play.** Decided against: the parent is a
  SwiftUI `List` inside a `Host`, and RNGH cannot arbitrate with a `UIScrollView` across the bridge.

## Documentation impact

- **Affected flows.** None exist to invalidate. **Create
  `docs/flows/browse-home-calendar.md`** — expanding, paging, and selecting a day is an
  independently testable journey with no flow document today. The previous plan promised it and
  never wrote it. It must state that markers are mock props, that selection is local and
  non-persistent, and that no Home content is filtered.
- **Affected shared systems.** Update [`ui.md`](../../app/ui.md) — it has no calendar content at
  all. It gains the RN-island-inside-`RNHostView` boundary, the animated-height bridge cost, the
  rule that Reanimated owns RN-island motion while `@expo/ui`'s `animation` modifier owns SwiftUI
  motion, and the Reduce Motion resolution. Update
  [`architecture.md`](../../app/architecture.md) only if the calendar's file layout warrants a note
  under **Feature-based organization**; otherwise record "none, and why".
- **New durable documents.** The flow above. No new `docs/app/` document — `ui.md` already owns
  every boundary involved.
- **Moved citations.** `calendar-theme.ts` is deleted and `components/day.tsx`'s props change. Grep
  for both across `docs/` and `features/` before closing. The previous plan and its five task notes
  cite Wix behavior throughout; they are historical and are **not** rewritten, but
  [`plans/weekly-calendar/plan.md`](../weekly-calendar/plan.md) is marked `superseded` and linked
  here.
- **`AGENTS.md`.** No change. Existing UI, Bun, and documentation rules cover this.

## Implementation phases

### Phase 0: dependencies and the two things that could invalidate the design

- [x] Add `@marceloterreiro/flash-calendar@2.0.0` and `@shopify/flash-list@2.3.2` exact-pinned with
      Bun; remove `react-native-calendars`. Confirm no `ios/Podfile.lock` change is produced.
- [x] Freeze `helpers/metrics.ts` and the internal prop shapes of `CalendarDay`, `CalendarWeekRow`,
      `CalendarMonthPage`, and `useCalendarExpansion` before any parallel work starts. These are the
      only interfaces two workers share.
- [x] **Spike A — the clip.** Drive an animated `height` + `translateY` inside the existing
      `RNHostView matchContents` list row and confirm the SwiftUI `List` below moves smoothly. This
      is the one risk the placement decision carries. If it stutters, the fallback is the
      sibling-island placement, and that is a user decision, not an implementer's.
- [x] **Spike B — the pager.** Confirm a horizontal, paged `FlashList` restores its offset when
      `data` and `renderItem` swap granularity at rest, with no visible flash. If not, take the
      stacked-pager fallback above and record it.
- [x] **Exit gate:** dependencies installed, shared interfaces frozen, both spikes answered in
      writing. Only then unblock the parallel workers.

### Phase 1: parallel implementation

- [x] **Worker A — cells and data.** `helpers/dates.ts`, `components/day.tsx`,
      `components/week-row.tsx`, `components/month-page.tsx`, `helpers/day-context.ts`,
      `components/month-header.tsx` comment.
- [x] **Worker B — motion and paging.** `hooks/use-expansion.ts`, `components/expand-toggle.tsx`,
      `components/pager.tsx`.
- [x] **Integration lead.** `helpers/metrics.ts`, deletion of `calendar-theme.ts`, the rewritten
      `index.tsx`, the `home-content.tsx` comment, and the merge.
- [x] **Exit gate:** one integrated build renders the collapsed strip, selects days from mock props,
      pages weeks collapsed and months expanded without changing selection, and opens and closes the
      month with the list below moving correctly.

### Phase 2: verification

- [x] Static gates, in order: `type-check`, `lint`, `prettier`.
- [x] Grep gates: no `react-native-calendars` anywhere; `@marceloterreiro/flash-calendar` and
      `@shopify/flash-list` imported only under `features/calendar/`; `runOnJS` absent.
- [x] Run the runtime acceptance matrix inherited from
      [`plans/weekly-calendar/plan.md`](../weekly-calendar/plan.md#runtime-acceptance-matrix). It was
      written against behavior, not against Wix, so it transfers unchanged — with **Reduce Motion now
      expected to pass** rather than being an open gate.
- [ ] Present the collapsed strip and expanded month to the user for visual approval.

### Phase 3: durable documentation and closure

- [x] Write `docs/flows/browse-home-calendar.md` from
      [`templates/flow.md`](../../templates/flow.md) and index it in
      [`docs/README.md`](../../README.md).
- [x] Update [`ui.md`](../../app/ui.md) as scoped above.
- [x] Mark [`plans/weekly-calendar/plan.md`](../weekly-calendar/plan.md) `superseded` with a link
      here.
- [ ] Re-run static gates; mark this plan `completed` only when code and documentation agree.

## Multi-agent execution model

Phase 0 is sequential and single-owner. After the exit gate, A and B run in parallel because their
file sets are disjoint; the integration lead owns everything either of them would otherwise contend
on. Agents share one worktree, so **no worker may format, reorganize, or "tidy" a file outside its
own column.**

| Workstream                   | Exclusive ownership                                                                                                                                       | Starts when                |
| ---------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------- |
| Integration lead             | `package.json`, `bun.lock`, `helpers/metrics.ts`, `calendar-theme.ts` deletion, `index.tsx`, `home-content.tsx`                                           | Immediately                |
| Worker A — cells and data    | `helpers/dates.ts`, `components/day.tsx`, `components/week-row.tsx`, `components/month-page.tsx`, `helpers/day-context.ts`, `components/month-header.tsx` | Phase 0 exit gate          |
| Worker B — motion and paging | `hooks/use-expansion.ts`, `components/expand-toggle.tsx`, `components/pager.tsx`                                                                          | Phase 0 exit gate          |
| Documentation worker         | `docs/flows/browse-home-calendar.md`, `docs/app/ui.md`, `docs/README.md`, plan statuses                                                                   | Integrated shape is stable |

QA and code review are read-only; defects route back to the owning column.

## Verification

```bash
bun run type-check
bun run lint
bunx prettier --write features/calendar features/home/home-content.tsx package.json docs/plans/flash-calendar-rewrite docs/flows/browse-home-calendar.md docs/app/ui.md docs/README.md
```

```bash
# must all return nothing
grep -rn "react-native-calendars" --include="*.ts" --include="*.tsx" --include="*.json" . --exclude-dir=node_modules --exclude-dir=ios --exclude-dir=docs
grep -rln "flash-calendar\|flash-list" --include="*.ts" --include="*.tsx" app features ui lib hooks | grep -v "^features/calendar/"
grep -rn "runOnJS" --include="*.ts" --include="*.tsx" features
```

Also confirm by hand that [`ios/Podfile.lock`](../../../ios/Podfile.lock) is unmodified and that no
`app/` route or `database/` file changed.

## Acceptance criteria

- [x] Every exported type in `types.ts` is unchanged, and
      `home-calendar-mocks.ts` is byte-identical. (`types.ts` itself is not
      byte-identical: its doc comment named the old vendor, so it had to be
      re-pointed. The types are the contract; the comment is not.)
- [x] `react-native-calendars` is removed; `calendar-theme.ts` is deleted; no vendor stylesheet key,
      navigation enum, or test-ID string match remains anywhere in the feature.
- [x] Collapsed swipes page one week; expanded swipes page one month; neither changes the selection.
- [x] The chevron opens and closes the month, the chevron turns with the height, and the SwiftUI list
      below moves with it without overlap or clipping.
- [x] With Reduce Motion enabled the calendar opens and closes instantly, with no bespoke branch in
      the component.
- [x] Every day is one ≥44pt button announcing its full local date, whether it is today, and its
      untruncated workout count; markers still cover 0/1/2/3/overflow and stay legible when selected.
- [x] `ios/Podfile.lock` is unchanged.
- [x] `docs/flows/browse-home-calendar.md` exists, is indexed, and matches verified behavior;
      `ui.md` covers the calendar; the previous plan is marked `superseded`.

## Non-goals

- Firestore reads, workout filtering, or replacing Home's mock markers.
- A `Timestamp` → local-date-ID adapter and its timezone/DST semantics.
- A drag-to-expand gesture.
- Moving the calendar out of the SwiftUI `List` row, unless Spike A forces the question.
- A calendar Zustand store, or persisting selection, visible month, or expansion.
- Android, a test runner, and any change to the public contract.

## Follow-up decisions

- **Un-cap Dynamic Type on the day number.** Now blocked only on the animation needing a JS-computable
  row height. Settled by either deriving row height from `PixelRatio.getFontScale()` or measuring one
  row with `onLayout` and feeding it to the shared value.
- **Drag-to-expand.** Reachable only if the calendar moves out of the SwiftUI `List`; revisit
  together with placement, never alone.
- **Marker density.** The three-dot cap plus overflow lozenge is unverified against real workout
  data; revisit when the calendar reads Firestore.
