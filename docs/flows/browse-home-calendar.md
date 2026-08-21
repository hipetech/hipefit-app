---
type: flow
status: current
area: calendar
updated: 2026-08-21
---

# Flow: browse the Home calendar

> **This journey is presentation only.** The calendar receives an empty marker list and touches no
> Firestore. **Selecting a day filters nothing** — Activity, the featured workout template and Recent
> Workouts are unaffected, and the selection is local component state that does not survive unmount.
> There is no calendar store or workout read path.

## User goal

Look at the current week on Home, move around the calendar, and pick a day.

The looking and moving are fully reachable. **Picking a day gets the user a moved selection circle
and nothing else** — no day summary or filtered history.

## Prerequisites

- **Signed in.** Home lives under `(private)`, which `apps/mobile/app/_layout.tsx` wraps in
  `<Stack.Protected>`; see
  [`apps/mobile/src/stores/use-auth-store.ts`](../../apps/mobile/src/stores/use-auth-store.ts).
- **Nothing else.** This is the one flow in `docs/flows/` with no data prerequisite. The calendar
  reads no store and subscribes to nothing: its empty markers arrive as props from Home and its dates
  come from the device clock, so it renders identically on a brand-new account and a populated one.

## Entry points

The calendar is not entered — it is already on screen.
[`apps/mobile/app/(private)/(home)/index.tsx`](<../../apps/mobile/app/(private)/(home)/index.tsx>)
mounts
[`apps/mobile/src/features/home/home-content.tsx`](../../apps/mobile/src/features/home/home-content.tsx),
which renders
[`ExpandableWeeklyCalendar`](../../apps/mobile/src/features/calendar/index.tsx) inside an
`RNHostView matchContents` row of the screen's SwiftUI `List`, directly below the profile greeting
row
([`home-header.tsx`](../../apps/mobile/src/features/home/home-header.tsx)). It is a full-bleed row
rather than a
card — `CALENDAR_ROW_MODIFIERS` in `home-content.tsx` strips the `insetGrouped` margins, background
and separator off that one row — and because it is a list row it **scrolls with the page** instead
of pinning above it. The boundary that makes this work, and what it costs, is in
[`ui.md`](../app/ui.md#the-calendar-a-react-native-island-inside-the-list).

Three affordances live inside it, and they are the whole journey:

| Affordance             | Where                                                                                                  | Notes                                                            |
| ---------------------- | ------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------- |
| **A day**              | [`components/day.tsx`](../../apps/mobile/src/features/calendar/components/day.tsx)                     | One ≥44pt button per day. The only thing that changes selection. |
| **Horizontal swipe**   | [`components/pager.tsx`](../../apps/mobile/src/features/calendar/components/pager.tsx)                 | Pages by week collapsed, by month expanded. Never selects.       |
| **The chevron toggle** | [`components/expand-toggle.tsx`](../../apps/mobile/src/features/calendar/components/expand-toggle.tsx) | Centred below the grid; opens and closes the month.              |

There is deliberately **no drag gesture**, and that is a placement consequence rather than an
omission: the calendar is a row of a scrolling SwiftUI `List`, and Gesture Handler cannot arbitrate
a vertical pan with a `UIScrollView` across the bridge. The button competes with nothing.

## Main path

1. **The user opens Home.** The calendar renders collapsed, on the week containing today, with today
   accented and selected. Home seeds its selection from `toLocalDateId(new Date())` once in a
   `useState` initializer; the calendar derives its own opening week and month from that date in
   [`index.tsx`](../../apps/mobile/src/features/calendar/index.tsx).
2. **The user swipes the strip sideways.** One swipe advances exactly one week, in either direction.
   Each pager renders three pages — previous, current, next — and recentres on the middle one every
   time it settles, reporting the move as a delta rather than an index
   ([`components/pager.tsx`](../../apps/mobile/src/features/calendar/components/pager.tsx)).
3. **The title follows the swipe, and a straddling week is titled by majority.** The month header
   names the _visible_ position, not the selection. A week split across two months belongs to the
   month containing its **fourth day** — `toWeekMonthStartDateId` in
   [`helpers/dates.ts`](../../apps/mobile/src/features/calendar/helpers/dates.ts) — so the week of 30 August
   2026 reads "September 2026" and expands into September.
4. **The user presses the chevron.** The month opens: the container's height animates from one week
   row to the month's full height while the grid translates so that the week already on screen stays
   where it is and the rest of the month grows around it. It is a clip over one surface, not a
   cross-fade —
   [`hooks/use-expansion.ts`](../../apps/mobile/src/features/calendar/hooks/use-expansion.ts)
   holds the single shared value both styles interpolate from, and the chevron turns with it rather
   than snapping. The SwiftUI list below is pushed down by the height, which is the reason the height
   is animated at all.
5. **The user swipes the open month sideways.** One swipe advances exactly one month. **The
   collapsed week does not move.** The calendar tracks two independent positions — a visible week and
   a visible month — precisely so that paging months while open cannot throw away the week the user
   came from.
6. **The user presses a day.** The circle moves to it, the calendar stays open if it was open, and
   the visible week moves to that day's week so that closing later returns to what was chosen rather
   than to what was browsed. This is the only path to `onDatePress`, and Home's handler sets
   `selectedDateId` and nothing else.
7. **The user presses the chevron again.** The month closes back to a single week row. In the common
   case nothing relocates — the remembered week is still drawn by the month on screen, so it is the
   week that survives. It only moves when the user paged far enough that the remembered week is no
   longer part of the grid; then it prefers the selected day's week, and falls back to the month's
   first row when the selection is elsewhere entirely.
8. — **The journey ends there.** A selected day produces no summary, no filter and no navigation.
   See **What is missing**.

Paging — by week, by month, in either direction — **never changes the selection**, at any point in
the sequence above. Selection is controlled by the caller and the calendar never sets it on its own;
the contract states this as a promise in
[`types.ts`](../../apps/mobile/src/features/calendar/types.ts).

## What is missing

Workout markers and their data path do not exist. Concretely, what is missing:

- **No Firestore read.** Home passes one stable empty marker array. The app has no workout store or
  workout read path to populate it.
- **No `Timestamp` → local-date-ID adapter.** The contract is stated in local calendar IDs shaped
  `YYYY-MM-DD`, and
  [`apps/mobile/src/lib/format.ts`](../../apps/mobile/src/lib/format.ts)'s `toLocalDateId` converts a
  JS `Date`.
  Turning a Firestore `Timestamp` into one is deliberately unbuilt: it has timezone and
  daylight-saving semantics that have to be settled before a query depends on them.
- **No day summary and no filtering.** `handleDatePress` in
  [`home-content.tsx`](../../apps/mobile/src/features/home/home-content.tsx) calls
  `setSelectedDateId` and returns.
  Nothing downstream reads the selected day.
- **No persistence.** No store, and nothing written anywhere.

## Screens, routes, and data involved

- **Route:** `(private)/(home)` —
  [`apps/mobile/app/(private)/(home)/index.tsx`](<../../apps/mobile/app/(private)/(home)/index.tsx>),
  which mounts one island and declares its own screen options.
- **Islands:**
  [`apps/mobile/src/features/home/home-content.tsx`](../../apps/mobile/src/features/home/home-content.tsx)
  owns the
  screen, selection, and empty marker props;
  [`apps/mobile/src/features/calendar/index.tsx`](../../apps/mobile/src/features/calendar/index.tsx)
  orchestrates the calendar. Under it: the title
  ([`components/month-header.tsx`](../../apps/mobile/src/features/calendar/components/month-header.tsx)),
  the `Sun`–`Sat` row
  ([`components/weekday-labels.tsx`](../../apps/mobile/src/features/calendar/components/weekday-labels.tsx)),
  the two pagers
  ([`components/pager.tsx`](../../apps/mobile/src/features/calendar/components/pager.tsx)) over week
  rows and month pages
  ([`components/week-row.tsx`](../../apps/mobile/src/features/calendar/components/week-row.tsx),
  [`components/month-page.tsx`](../../apps/mobile/src/features/calendar/components/month-page.tsx)),
  the cells ([`components/day.tsx`](../../apps/mobile/src/features/calendar/components/day.tsx),
  [`components/marker-dots.tsx`](../../apps/mobile/src/features/calendar/components/marker-dots.tsx)),
  and the toggle
  ([`components/expand-toggle.tsx`](../../apps/mobile/src/features/calendar/components/expand-toggle.tsx)).
- **Documents: none.** This flow touches no Firestore collection, so there is nothing to look up in
  [`docs/db-structure.md`](../db-structure.md). Selection and markers arrive as the props declared in
  [`types.ts`](../../apps/mobile/src/features/calendar/types.ts);
  `@marceloterreiro/flash-calendar`
  supplies date arithmetic only and none of its types reach a call site.

## State and data changes

**Writes: none.** Nothing on this journey reaches Firestore, and no Zustand store is involved.

What is read, and where it lives:

- **`selectedDateId`** — `useState` in
  [`home-content.tsx`](../../apps/mobile/src/features/home/home-content.tsx),
  seeded with today. Controlled: it is passed down and only `onDatePress` changes it.
- **`dateMarkers`** — one module-level empty array in
  [`home-content.tsx`](../../apps/mobile/src/features/home/home-content.tsx).
- **The visible week and the visible month** — two `useState` values in
  [`index.tsx`](../../apps/mobile/src/features/calendar/index.tsx),
  deliberately not derived from one another.
- **The open/closed position** — a Reanimated shared value plus its two mirrors (`isExpanded` for
  intent and accessibility, `isMonthMounted` for whether the month grid stays mounted) in
  [`hooks/use-expansion.ts`](../../apps/mobile/src/features/calendar/hooks/use-expansion.ts).

All of it is transient. Leaving Home and coming back to a fresh mount restores the initial state:
collapsed, on today's week, with today selected. Nothing persists across a relaunch, and nothing is
shared with another screen.

One cache is worth knowing about because it has a clock in it: month grids are memoized in
[`components/month-page.tsx`](../../apps/mobile/src/features/calendar/components/month-page.tsx)
under a key that
includes **today's date ID**, because the library resolves `isToday` when a grid is built and bakes
the answer into all 42 days. An app left open across midnight therefore re-derives its grids rather
than keeping the accent ring on yesterday.

## Alternative, empty, and error paths

- **No loading state.** The calendar takes no `isLoading` input and awaits nothing. Home redacts only
  its profile header while user data loads; the calendar and workout empty states are fully drawn from
  the first frame.
- **No error state.** There is no subscription and no async call, so there is no failure to report.
- **Every day has no workouts** and draws an empty marker row of the same fixed height as a marked one,
  so the day numbers will not shift when real markers return. Each day announces "no workouts"
  ([`components/marker-dots.tsx`](../../apps/mobile/src/features/calendar/components/marker-dots.tsx),
  `describeCalendarDay` in
  [`helpers/dates.ts`](../../apps/mobile/src/features/calendar/helpers/dates.ts)).
- **Marker overflow presentation remains implemented but unreachable** until a real marker source is
  connected.
- **Days from the adjacent month** are dimmed inside an expanded month grid and **not** dimmed in the
  collapsed strip. The surface decides rather than the cell: a straddling week has no anchor month,
  and dimming five of its seven days while the header names the other month is the failure that
  `dimOutsideMonth={false}` prevents.
- **Reduce Motion** collapses the open and close to an instant change, with no branch in any
  component — Reanimated's `withSpring` jumps to its target under the system setting. Note for
  testers: iOS applies the setting to an already-running app only after a relaunch.
- **Dynamic Type** scales the day number up to a 1.4 cap
  (`CALENDAR_DAY_NUMBER_MAX_SCALE` in
  [`helpers/metrics.ts`](../../apps/mobile/src/features/calendar/helpers/metrics.ts)),
  a deviation from [`ui.md`](../app/ui.md#typography) that the constant documents: the row pitch is
  what the expansion animation interpolates over, so it has to be known before the first frame. The
  weekday labels and the month title sit outside the clip and scale freely.
- **VoiceOver** reaches one element per day — role `button`, label "Wednesday, 12 August 2026, today,
  no workouts", `accessibilityState.selected` — and skips the weekday labels and marker row.

## Completion state

There is no terminal state to reach. The user is left with a moved selection circle, a calendar
positioned wherever they browsed to, and no change anywhere else in the app: no Firestore document,
no store value, no navigation. The **intended** terminal state — a day whose real workouts are
summarized or filtered into view — is not implemented, and nothing writes toward it.
