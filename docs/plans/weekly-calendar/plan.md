---
type: plan
status: in-progress
area: calendar
created: 2026-08-07
---

# Plan: expandable weekly calendar

## Outcome

Home shows a standalone calendar feature backed internally by Wix
`react-native-calendars`. Its collapsed state matches the supplied seven-day reference, horizontal
swipes browse weeks without changing the selected date, a downward drag expands the current month,
and workout markers render as dots from mock props owned by Home.

The feature publishes a small Hipefit contract rather than Wix props or types. It introduces no
calendar store, Firestore read, workout filtering, or local-date conversion in this initiative.

## Context

Home is currently one screen-filling SwiftUI `Host` around an `insetGrouped` `List` in
[`home-content.tsx`](../../../features/home/home-content.tsx). An expanding React Native calendar
cannot live directly in that SwiftUI tree, and hosting it as a dynamically sized `RNHostView` list
row would make Wix's animated height depend on cross-bridge intrinsic-size invalidation. The safer
shape is one React Native screen container with two sibling islands: the Wix calendar above and the
existing screen-filling SwiftUI `Host` below. The Host continues to own real flex space, as required
by [`ui.md`](../../app/ui.md#host-ownership).

The selected state and workout dots are demonstration data in this initiative. Home passes local
calendar IDs shaped as `YYYY-MM-DD`; defining how Firestore timestamps become those IDs belongs to a
future data adapter and is deliberately not inferred here. The existing data and store boundaries
in [`architecture.md`](../../app/architecture.md) remain unchanged.

Wix's `ExpandableCalendar` is the chosen interaction engine because it already implements the
vertical open/close pan, the collapsed horizontal week pager, and the expanded horizontal month
pager. Its built-in day and header text disable font scaling, so Hipefit must replace those visible
pieces rather than theme the defaults. The dependency must be pinned exactly because the geometry
needed to match the reference includes Wix implementation details, including a fixed internal week
height.

## Approach

### Public feature contract

Create `features/calendar/` as a self-contained feature. Freeze this product-facing contract before
parallel work begins:

```ts
export type CalendarMarkerTone = 'accent' | 'success' | 'warning';

export interface CalendarMarker {
  id: string;
  tone: CalendarMarkerTone;
}

export interface CalendarDateMarkers {
  dateId: string;
  markers: readonly CalendarMarker[];
}

export interface ExpandableWeeklyCalendarProps {
  selectedDateId: string;
  dateMarkers: readonly CalendarDateMarkers[];
  onDatePress: (dateId: string) => void;
}
```

Do not expose `CalendarProvider`, `ExpandableCalendarProps`, Wix `DateData`, marking objects, theme
keys, navigation enums, or refs. The wrapper alone translates the Hipefit contract into Wix's API.
The visual layer renders at most three dots; when more workouts exist, the third position becomes an
overflow treatment and the accessibility label still announces the full count.

The contract uses controlled selection. The wrapper may keep visible week/month and expanded state
locally because those are transient presentation state; it must not add Zustand. A horizontal swipe
updates only the visible anchor. A day press calls `onDatePress`, and Home updates
`selectedDateId`. Wix automatic selection must be disabled for week scroll, month scroll, and arrow
navigation so a page transition can never masquerade as a day choice. `onDateChanged` must never
forward into `onDatePress`. As defense in depth, the wrapper derives the selected Wix marking from
the explicit `selectedDateId`, and the custom day reads that marking rather than Wix's transient
`state === 'selected'` value.

### Wix adapter and native-looking cells

Add exact-pinned `react-native-calendars@1.1314.0` with Bun. It is a JavaScript dependency, so no Pod
installation or `ios/Podfile.lock` change is expected. One integration owner owns
`package.json`, `bun.lock`, and the frozen type module so dependency and contract changes cannot race
with feature workers.

The wrapper contains `CalendarProvider` and `ExpandableCalendar`, starts collapsed, retains vertical
pan, keeps horizontal paging enabled, and does not close merely because a day was pressed. All Wix
imports stay under `features/calendar/`.

Replace or hide Wix's visible defaults where they conflict with the app UI rules:

- A custom weekday header renders `Sun` through `Sat` with Hipefit's RN `Text`, Dynamic Type, and
  semantic secondary color.
- A custom month header appears only while expanded, so the collapsed state can match the reference
  without an extra title row.
- A custom day component renders the number with tabular digits, a system-accent selected circle,
  semantic selected content, and the workout-dot row. The whole column remains one 44pt-or-larger
  button and one VoiceOver element.
- Wix theme and internal stylesheet overrides live in one version-pinned theme module. Call sites do
  not know their keys.
- Stable pure helpers build Wix markings, marker tones, and accessibility labels. Components contain
  wiring and JSX only.

At the default content size, the collapsed design targets the supplied reference: seven equal
columns, footnote weekday labels, title-sized day numbers, a 44pt selected circle, system grouped
background, system accent, and no library shadow. Dynamic Type may grow the row rather than preserve
the screenshot's fixed height.

### Home integration and mock ownership

Home owns deterministic mock dates, marker data, and controlled selection in
`features/home/`. The route remains unchanged. Refactor the Home screen island into an RN container
whose first child is `ExpandableWeeklyCalendar` and whose second child is the existing
screen-filling SwiftUI `Host`/`List`. The calendar must push the list down as its height animates; it
must never overlay the list or open a nested Host.

The mock demonstrates unmarked dates, one marker, multiple markers, overflow, and markers on the
selected date. Selecting a date changes only the blue circle and accessibility state; it does not
filter Activity, routines, or recent workouts.

### Risk gate before parallel implementation

The integration owner performs a narrow runtime proof immediately after installing the pinned
dependency. This is implementation validation, not another research phase:

1. Confirm Wix's animated collapsed/open height participates in RN flex layout above the Home Host.
2. Confirm a custom 44pt selected cell plus dots fits closed and every open month row without overlap
   or clipping on the smallest supported iPhone.
3. Confirm a diagonal drag resolves to exactly one gesture: horizontal paging or vertical expansion.
4. Confirm the custom header/day path removes every visible Wix `allowFontScaling={false}` label.
5. Confirm Reduce Motion behavior. If Wix's RN spring ignores the system setting, freeze one of two
   explicit resolutions before feature work continues: an isolated pinned-package patch that snaps
   open/closed transitions, or a user-approved documented exception. Do not silently ship motion
   that contradicts [`ui.md`](../../app/ui.md#reduce-motion).
6. Confirm Wix 1.1314.0 runs under React 19.2 and React Native 0.86, adapts semantic iOS
   `ColorValue` tokens despite its narrower theme types, and updates after a live system/light/dark
   theme change rather than caching the mount-time theme.
7. Confirm four-, five-, and six-week months produce correct animated heights after week and month
   navigation. Repeat with VoiceOver enabled before mount: Wix switches to a separate accessible
   full-month rendering path, which must preserve selection and marker semantics even though
   expansion is no longer the primary interaction.

If dynamic layout cannot be made correct without editing Wix internals, stop the parallel wave and
record whether the exact design or the unpatched dependency is the higher-priority constraint. Do
not spread compensating offsets through Home or individual cells.

### Rejected alternatives

- **Pure `@expo/ui` SwiftUI calendar.** Native `TabView` can page weeks and SwiftUI can draw dots,
  but the installed Expo UI bridge does not expose `DragGesture`; reproducing interactive vertical
  expansion would require a separate gesture layer or native module and more application-owned
  behavior.
- **Wix inside `RNHostView` in the SwiftUI list.** It preserves the current Home tree on paper but
  makes the expanding row depend on animated RN size crossing back into SwiftUI list measurement.
- **Passing Wix props through the feature.** This saves a few adapter lines and makes every consumer,
  mock, and future store depend on the vendor contract.
- **A calendar Zustand store now.** Selected and expanded state have one Home call site and no
  persistence or cross-screen consumer.

## Multi-agent execution model

The contract and dependency gate are sequential. After they pass, calendar implementation and Home
integration may proceed in parallel because their ownership areas do not overlap. Agents share one
worktree, so each worker must preserve concurrent edits and must not format or rewrite files outside
its assigned area.

| Workstream              | Exclusive ownership                                                                                                      | Starts when                                          | May run with                               |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------- | ------------------------------------------ |
| Integration lead        | `package.json`, `bun.lock`, `features/calendar/calendar-types.ts`, final merge and shared commands                       | Immediately                                          | Nothing until the risk gate passes         |
| Calendar feature worker | All other `features/calendar/**` files                                                                                   | Contract and runtime risk gate are frozen            | Home worker                                |
| Home integration worker | `features/home/home-content.tsx`, `features/home/home-calendar-mocks.ts` and Home-only layout styles                     | Contract is frozen                                   | Calendar worker                            |
| Development validator   | Read-only simulator evidence through `agent-device`                                                                      | First runnable integration                           | Documentation worker                       |
| Documentation worker    | `docs/app/architecture.md`, `docs/app/ui.md`, `docs/flows/browse-home-calendar.md`, `docs/README.md`, plan/task statuses | Integrated shape is stable                           | Development validation                     |
| QA agent                | Read-only `qa-mobile` acceptance pass                                                                                    | Static gates and focused development validation pass | Nothing; defects return to original owners |

`package.json`, `bun.lock`, and the frozen contract are shared hot spots and therefore have one
owner. The Home worker must not add temporary Wix imports. The calendar worker must not restructure
Home. QA agents report defects but do not edit source; fixes return to the worker that owns the
affected files. A code-review agent reviews the integrated diff after fixes, not each partial tree.

Detailed handoffs live under [`tasks/`](tasks/):

- [`prepare-calendar-contract.md`](tasks/prepare-calendar-contract.md)
- [`build-expandable-calendar.md`](tasks/build-expandable-calendar.md)
- [`integrate-home-calendar.md`](tasks/integrate-home-calendar.md)
- [`verify-calendar.md`](tasks/verify-calendar.md)
- [`reconcile-calendar-documentation.md`](tasks/reconcile-calendar-documentation.md)

## Documentation impact

- **Affected flows.** Existing flows are unchanged. Create `docs/flows/browse-home-calendar.md`
  because expanding, paging, and selecting the new Home calendar form an independently testable
  user journey. The flow must be explicit that markers are mock props, selection is local and
  non-persistent, and no Home content is filtered.
- **Affected shared systems.** Update [`architecture.md`](../../app/architecture.md) because Home is
  no longer shaped around one root Host; update [`ui.md`](../../app/ui.md) with the RN-calendar plus
  sibling SwiftUI-Host boundary, the reason `RNHostView` is rejected, the version-pinned Wix findings,
  Dynamic Type ownership, semantic styling, gesture ownership, and Reduce Motion result.
- **New durable documents.** Create and index the Home-calendar flow named above. No new app document
  is needed because the two affected app documents already own the relevant shared boundaries.
- **Moved citations.** None planned. If Home components are extracted or renamed during integration,
  search and update their citations in the same change.
- **`AGENTS.md`.** No change. Existing UI, feature, Bun, and documentation rules cover this work.

## Implementation phases

### Phase 0: freeze contract and prove integration risks

- [x] Add exact-pinned `react-native-calendars` with Bun; record the inspected version beside every
      internal theme or geometry override.
- [x] Publish `calendar-types.ts` with the contract above and no Wix imports.
- [x] Build the smallest temporary Home-hosted calendar needed to execute the five risk-gate checks;
      remove throwaway code rather than leaving a parallel component pattern.
- [x] Record compatibility, geometry, gesture, Dynamic Type, VoiceOver, theme, and Reduce Motion
      outcomes in this plan or source comments that own the resulting workaround — see
      [`prepare-calendar-contract.md`](tasks/prepare-calendar-contract.md#what-the-gate-actually-found).
      Reduce Motion is **not** settled: Wix springs open and closed unconditionally, and no patch or
      accepted exception has been agreed yet.
- [x] **Exit gate:** dependency, layout, gesture arbitration, accessible text, and motion strategy are
      frozen. Only then unblock both implementation workers.

### Phase 1: parallel feature and Home foundations

- [x] Calendar worker implements the wrapper, custom visible components, helpers, accessibility,
      theme isolation, expanded-state reporting, and marker rendering under `features/calendar/`.
- [x] Home worker adds deterministic mocks, controlled selection, and the sibling RN/SwiftUI layout
      without importing Wix.
- [x] Each worker formats only owned files and runs targeted TypeScript checks where possible; the
      integration lead resolves only true cross-boundary issues after both outputs exist.
- [x] **Exit gate:** one integrated Home build renders the collapsed reference, selects dates from
      mock props, pages weeks without selection changes, expands to a month, and keeps the Home list
      usable. Confirmed on an iPhone 17 Pro simulator (iOS 26.5): collapsed strip, day press, week
      paging, drag-to-expand, month paging, and collapse all behave as specified, and every day is
      one button announcing its date, today, and its full workout count.

### Phase 2: verification, fixes, and visual approval

- [ ] Run the static gates in the required order: type-check, lint, then formatting verification.
- [ ] Run the focused simulator matrix below with `agent-device`, capturing collapsed and expanded
      screenshots plus accessibility evidence.
- [ ] Present the reference-aligned collapsed state and expanded month to the user for visual
      approval before broad QA.
- [ ] Route defects to calendar or Home owners, integrate fixes, and repeat affected cases.
- [ ] Run the read-only `qa-mobile` pass and an integrated code review after focused cases are green.
- [ ] **Exit gate:** every required case passes or has explicit user acceptance with rationale.

### Phase 3: durable documentation and closure

- [ ] Update the two affected app documents, create the Home-calendar flow, and index it against
      verified code and runtime behavior.
- [ ] Re-run static gates after documentation and any final review fixes.
- [ ] Mark task notes and this plan completed only when code, evidence, and durable documentation
      agree.

## Verification and test cases

The repository has no unit-test runner. This initiative does not add one solely for a UI wrapper;
static checks and focused iOS runtime tests are the evidence. If the separate Maestro initiative has
landed before implementation, add a calendar acceptance flow there; otherwise this plan must not
claim automated gesture coverage that does not exist.

### Static gates

Run in this order:

```bash
bun run type-check
bun run lint
bunx prettier --check package.json features/calendar features/home docs/plans/weekly-calendar docs/app/architecture.md docs/app/ui.md docs/flows/browse-home-calendar.md docs/README.md
```

Verify separately that Wix imports occur only under `features/calendar/`, that no calendar store was
added, and that neither `app/` route files nor database files changed.

### Runtime acceptance matrix

| Area                 | Case                                                                    | Expected result                                                                                                                                                      |
| -------------------- | ----------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Initial state        | Launch Home from a clean development run                                | Calendar starts collapsed on the mock-selected week; selected circle and all seven labels match the reference hierarchy.                                             |
| Selection            | Tap an unselected day                                                   | `onDatePress` fires once, Home changes only `selectedDateId`, and the circle moves without changing unrelated Home content.                                          |
| Week paging          | Swipe left and right while collapsed                                    | Exactly one week page settles; visible dates change and the selected date remains unchanged, even when off-screen.                                                   |
| Month expansion      | Drag downward from the calendar                                         | Calendar follows or resolves the gesture into the expanded current month and pushes the SwiftUI list down without overlay or clipping.                               |
| Month collapse       | Drag upward while expanded                                              | Calendar returns to the week containing the visible anchor; selection remains unchanged.                                                                             |
| Month paging         | Swipe left and right while expanded                                     | Exactly one month changes; no day becomes selected from navigation alone.                                                                                            |
| Gesture arbitration  | Try shallow diagonal, fast horizontal, and fast vertical drags          | One gesture wins consistently; week/month paging never also toggles expansion, and Home's vertical list does not scroll when the calendar owns the drag.             |
| Day press while open | Select a date in the expanded month                                     | The date becomes selected and the calendar remains open; collapsing later reveals the correct selected/visible week.                                                 |
| Markers              | Render 0, 1, 2, 3, and more than 3 workouts                             | Dots use semantic tones, remain legible selected/unselected, use the documented overflow treatment, and never change cell width.                                     |
| Boundaries           | Page across month end, year end, February 29, and a DST transition week | Dates remain ordered with no duplicates or omissions; navigation does not mutate selection.                                                                          |
| Loading independence | Exercise Home's existing loading/redaction path                         | Calendar mocks remain stable and the existing SwiftUI list still redacts and enables exactly as before.                                                              |
| Light/dark/system    | Switch all three app theme settings while Home is visible               | Background, labels, selected circle, selected text, and dots update from semantic tokens with sufficient contrast.                                                   |
| Dynamic Type         | Test default, XL, and an accessibility size                             | Visible calendar text scales; labels, dots, rows, and month controls do not clip or overlap.                                                                         |
| Reduce Motion        | Enable Reduce Motion before opening and paging                          | Open/close and page transitions follow the Phase 0 motion decision and never use an unapproved spring.                                                               |
| VoiceOver            | Navigate collapsed and expanded calendars                               | Each day is one button announcing full local date, selected/disabled state, and workout count; decorative weekday text and dots do not become duplicate focus stops. |
| VoiceOver launch     | Enable VoiceOver before mounting Home                                   | Wix's accessible full-month path remains usable, announces the same controlled selection and marker counts, and page navigation does not select a date.              |
| Hit targets          | Inspect day and expansion controls                                      | Every interactive target is at least 44pt and remains tappable across its visible bounds.                                                                            |
| Layout sizes         | Test the smallest and largest available iPhones in portrait             | Seven columns stay equal; expansion leaves usable Home content and does not cross safe areas or navigation chrome.                                                   |
| Month heights        | Expand four-, five-, and six-week months                                | The calendar height matches the rendered rows without clipping the last row, leaving dead space, or covering Home content.                                           |
| Home navigation      | Scroll the list, collapse/restore the large title, and switch tabs      | The greeting title still follows list scrolling; returning to Home restores a valid calendar height and the agreed local selection lifetime.                         |
| Re-entry             | Leave Home, return, background, and resume                              | No gesture or animation is stuck; selected controlled data is consistent with the agreed Home-state lifetime.                                                        |

## Acceptance criteria

- [ ] Home renders the independent calendar feature from mock props and owns only controlled mock
      selection; no calendar or data store is added.
- [ ] The collapsed calendar matches the supplied native reference at default Dynamic Type, including
      Sunday-first labels, equal columns, semantic colors, and a 44pt selected circle.
- [ ] Workout dots cover the specified count cases and expose the full count to accessibility.
- [ ] Horizontal navigation changes week/month visibility without selecting a day.
- [ ] Down/up gestures expand and collapse the calendar without conflicting with horizontal paging
      or the Home list.
- [ ] Home uses sibling RN and SwiftUI islands with no nested Host and no dynamically expanding
      `RNHostView` row.
- [ ] Wix APIs, theme internals, and navigation enums are contained under `features/calendar/`.
- [ ] Light/dark mode, Dynamic Type, VoiceOver, 44pt targets, and Reduce Motion pass the runtime
      matrix.
- [ ] Wix's alternate VoiceOver rendering path, variable month heights, live theme changes, large
      Home title behavior, and tab re-entry pass the runtime matrix.
- [ ] Type-check, lint, targeted formatting verification, focused mobile QA, and integrated code
      review pass.
- [ ] Every document named under **Documentation impact** matches verified behavior.

## Non-goals

- Firestore reads, workout filtering, calendar-backed history queries, or replacing Home mock data.
- A calendar Zustand store, subscription, or persisted selected/visible/expanded state.
- Converting workout timestamps to local date IDs or defining timezone migration behavior.
- Android behavior, platform fallbacks, or `.android.tsx` files.
- A month-picker route, date ranges, agenda/timeline views, event creation, or editing workouts.
- Exposing Wix as a reusable app-wide API or adopting its default visual language.
- Adding a unit-test runner or claiming gesture automation before the Maestro system exists.

## Follow-up decisions

- Replace Home mocks with a local-date adapter only when real workout filtering or day summaries are
  in scope; that work must define timezone and daylight-saving semantics before reading Firestore.
- Promote calendar state into Zustand only if a second screen or navigation boundary needs to share
  it.
- Reassess marker overflow presentation with real workout density data; this plan preserves the full
  count for accessibility but caps visible dots to protect cell geometry.
