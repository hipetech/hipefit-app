import { useCallback, useState } from 'react';
import { Host } from '@expo/ui';
import {
  Button,
  HStack,
  Image,
  List,
  ScrollView,
  Section,
  Spacer,
  Text,
  VStack,
} from '@expo/ui/swift-ui';
import {
  Animation,
  animation,
  contentTransition,
  listRowBackground,
  listRowInsets,
  listRowSeparator,
  monospacedDigit,
  padding,
} from '@expo/ui/swift-ui/modifiers';

import { useRoutineStore } from '@/features/routines/store/use-routine-store';
import { useWorkoutStore } from '@/features/workouts/store/use-workout-store';
import { useAppColorScheme } from '@/hooks/use-app-color-scheme';
import { useReduceMotion } from '@/hooks/use-reduce-motion';
import { colors } from '@/theme/colors';
import { mods } from '@/theme/modifiers';
import { layout } from '@/theme/styles';
import { Card } from '@/ui/card';

import { ActiveWorkoutBanner } from './active-workout-banner';
import { RoutineCard } from './routine-card';
import { WorkoutHistoryCard } from './workout-history-card';

/**
 * How many history rows are rendered at once.
 *
 * A SwiftUI `List` is **not** virtualized — every row is a JSX node kept alive
 * on the JS thread — and the workout store subscribes to the *whole* history,
 * which grows without bound (a daily lifter passes a thousand rows in three
 * years). So the list is paged: one page is rendered, and a "Show N More" row
 * reveals the next page on demand.
 */
const HISTORY_PAGE_SIZE = 20;

/**
 * Horizontal margin of an `insetGrouped` section card.
 *
 * The routine carousel zeroes its leading/trailing `listRowInsets` so the strip
 * can scroll edge to edge; this puts the same margin back *inside* the scroll
 * content, so the first card lines up with every other section's card and the
 * last card gets matching breathing room after it (the App Store idiom).
 */
const SECTION_HORIZONTAL_MARGIN = 16;

/**
 * Full-bleed carousel row: the App Store idiom for a horizontal strip inside a
 * grouped list. Zero leading/trailing row insets and the page background make
 * the row itself disappear; the section margin is re-applied to the content so
 * the cards stay aligned.
 */
const CAROUSEL_ROW_MODIFIERS = [
  listRowInsets({
    top: 8,
    leading: 0,
    bottom: 8,
    trailing: 0,
  }),
  listRowBackground(colors.systemGroupedBackground),
  listRowSeparator('hidden'),
];

/** Puts the section margin the carousel row gave up back inside its content. */
const CAROUSEL_CONTENT_MODIFIERS = [
  padding({ horizontal: SECTION_HORIZONTAL_MARGIN }),
];

/** Stable keys for the rows rendered behind `redacted('placeholder')`. */
const PLACEHOLDER_ROUTINE_KEYS = ['routine-a', 'routine-b'];
const PLACEHOLDER_HISTORY_KEYS = ['history-a', 'history-b', 'history-c'];

/**
 * How the routine count rolls to its new value. Matches Home's Activity
 * figures — 250ms of ease-in-out, well inside the ~300ms motion budget.
 */
const COUNTER_ANIMATION = Animation.easeInOut({ duration: 0.25 });

/**
 * The section header's trailing count. Font-*refining* only, so the count keeps
 * inheriting the header font and color the list style publishes.
 */
const COUNT_MODIFIERS = [monospacedDigit()];

interface SectionHeaderProps {
  title: string;
  /** Trailing count. Omit it entirely to render a plain header. */
  count?: number;
  /**
   * Roll the count with `numericText` when it changes instead of hard-cutting
   * it. The caller turns this off under Reduce Motion.
   */
  animateCount?: boolean;
}

/**
 * Grouped-list section header with an optional trailing count.
 *
 * This exists because `badge()` on a `<Section title=…>` is broken: instead of
 * decorating the header it collapses the title *into* the first row, so the
 * heading renders beside the row content with the count floating on the right.
 * `Section` accepts a custom `header` node, which is the supported escape hatch
 * — note the Swift side only reads the `header` slot when `title` is unset, so
 * the two props are mutually exclusive.
 *
 * Neither `Text` carries a font or color modifier **on purpose**: the list style
 * publishes the header font, color and text case through the SwiftUI
 * environment, and the header slot is a plain child view, so both inherit them.
 * Hard-coding `footnote` + `secondaryLabel` here would look right today but
 * silently drift from the sections that still use `title` (e.g. History).
 *
 * The count does take `monospacedDigit()`, which is font-*refining* rather than
 * font-*setting*, so it leaves that inheritance intact. It is a standalone
 * figure that changes in place as routines are added or removed; proportional
 * digits make it jump sideways against the trailing edge each time.
 *
 * For the same reason it also earns the rolling `numericText` transition: the
 * routine store is a live subscription, so the count moves under the user while
 * this screen is on top. Both motion modifiers go *after* `monospacedDigit()`
 * (index 0 is innermost), so they wrap the fully resolved text rather than
 * being re-resolved by it. `animation` is what supplies the transaction —
 * `contentTransition` alone does nothing.
 */
const SectionHeader = ({ title, count, animateCount }: SectionHeaderProps) => (
  <HStack alignment="center">
    <Text>{title}</Text>
    <Spacer />
    {count != null ? (
      <Text
        modifiers={
          animateCount
            ? [
                ...COUNT_MODIFIERS,
                contentTransition('numericText'),
                animation(COUNTER_ANIMATION, count),
              ]
            : COUNT_MODIFIERS
        }
      >
        {String(count)}
      </Text>
    ) : null}
  </HStack>
);

/** A routine card shaped like the real one, shown while the stores load. */
const PlaceholderRoutineCard = () => (
  <Card width={200} radius={12} spacing={8}>
    <Text modifiers={mods.headlineLabel}>Placeholder Routine</Text>
    <VStack alignment="leading" spacing={2}>
      <Text modifiers={mods.footnoteSecondary}>8 exercises</Text>
      <Text modifiers={mods.footnoteSecondary}>~45 min</Text>
    </VStack>
  </Card>
);

/** A history row shaped like the real one, shown while the stores load. */
const PlaceholderHistoryRow = () => (
  <HStack alignment="center" spacing={12}>
    {/* Sized with a text style, never a fixed `size`, so the glyph tracks
        Dynamic Type like every other leading symbol in the app. */}
    <Image
      systemName="circle.fill"
      color={colors.systemGray}
      modifiers={mods.title3}
    />
    <VStack alignment="leading" spacing={2}>
      <Text modifiers={mods.bodyLabel}>Placeholder Workout</Text>
      <Text modifiers={mods.footnoteSecondary}>Jan 1, 2026 · 45 min</Text>
    </VStack>
    <Spacer />
    {/* Mirrors the real row's trailing figure modifier-for-modifier, including
        `monospacedDigit()`: redaction draws a bar the width of the *measured*
        text, so a placeholder that resolves a different font measures — and
        therefore redacts — to a different width than the row it stands in for.
        That invariant is why both this row and `WorkoutHistoryCard` reach for
        the same `mods.bodyLabelMono` — the shared constant is what keeps the
        two from drifting apart one edit at a time. */}
    <Text modifiers={mods.bodyLabelMono}>1.2k kg</Text>
  </HStack>
);

/** Muted single-row stand-in for an empty section. */
const EmptyRow = ({ label }: { label: string }) => (
  <Text modifiers={mods.bodySecondary}>{label}</Text>
);

/**
 * Body of the Workouts screen.
 *
 * The component reads the workout and routine stores itself and takes no props,
 * so the route file stays thin (title + toolbar + this island).
 *
 * One `Host` filling the screen (`flex: 1`, deliberately **no**
 * `matchContents`) around one SwiftUI `List` with `listStyle('insetGrouped')`.
 * A `List` has no intrinsic content height, so it can only live at the root of
 * a Host that owns real space. `insetGrouped` supplies the 16pt margins, 44pt
 * row heights, inset hairlines and grouped background for free — which is what
 * retires the hand-drawn divider, the chip beside the heading, the `EmptyCard`s
 * and the skeleton island this screen used to hand-roll.
 *
 * Empty states are a muted row plus a `Section` footer rather than a
 * `ContentUnavailableView`. Apple uses that view as the *whole* screen, never as
 * a list row (as a row it is just the tall hand-rolled empty card this migration
 * set out to delete), and a whole-screen variant does not fit here: the two
 * sections empty independently, so it would only ever be correct on a brand-new
 * account, and swapping the `List` out for a non-scrolling view takes away the
 * scroll view UIKit uses to collapse the large title.
 */
export const WorkoutsContent = () => {
  const colorScheme = useAppColorScheme();
  const reduceMotion = useReduceMotion();
  const {
    workouts,
    inProgressWorkout,
    isLoading: workoutsLoading,
  } = useWorkoutStore();
  const { activeRoutines, isLoading: routinesLoading } = useRoutineStore();

  const [visibleCount, setVisibleCount] = useState(HISTORY_PAGE_SIZE);

  const isLoading = workoutsLoading || routinesLoading;
  const completedWorkouts = workouts.filter(
    (w) => w.data.status !== 'in_progress'
  );
  const visibleWorkouts = completedWorkouts.slice(0, visibleCount);
  const remainingCount = completedWorkouts.length - visibleWorkouts.length;
  const nextPageCount = Math.min(remainingCount, HISTORY_PAGE_SIZE);
  const hasRoutines = activeRoutines.length > 0;

  const showMoreHistory = useCallback(() => {
    setVisibleCount((count) => count + HISTORY_PAGE_SIZE);
  }, []);

  return (
    <Host style={layout.groupedScreen} colorScheme={colorScheme}>
      <List
        modifiers={
          isLoading ? mods.listInsetGroupedRedacted : mods.listInsetGrouped
        }
      >
        {inProgressWorkout ? (
          <Section title="In Progress">
            <ActiveWorkoutBanner workout={inProgressWorkout} />
          </Section>
        ) : null}

        {/* The routine count rides the header, Reminders-style. It is omitted
            while loading and when there are none: SwiftUI hides a zero badge,
            but a header string always renders, and a literal "0" beside an
            empty state is noise. */}
        <Section
          header={
            <SectionHeader
              title="My Routines"
              count={
                !isLoading && hasRoutines ? activeRoutines.length : undefined
              }
              animateCount={!reduceMotion}
            />
          }
          footer={
            !isLoading && !hasRoutines ? (
              <Text>
                Create a routine and it will show up here, ready to start in one
                tap.
              </Text>
            ) : undefined
          }
        >
          {isLoading || hasRoutines ? (
            <ScrollView
              axes="horizontal"
              showsIndicators={false}
              modifiers={CAROUSEL_ROW_MODIFIERS}
            >
              <HStack
                alignment="top"
                spacing={12}
                modifiers={CAROUSEL_CONTENT_MODIFIERS}
              >
                {isLoading
                  ? PLACEHOLDER_ROUTINE_KEYS.map((key) => (
                      <PlaceholderRoutineCard key={key} />
                    ))
                  : activeRoutines.map((routine) => (
                      <RoutineCard key={routine.id} routine={routine} />
                    ))}
              </HStack>
            </ScrollView>
          ) : (
            <EmptyRow label="No routines yet" />
          )}
        </Section>

        <Section
          title="History"
          footer={
            !isLoading && visibleWorkouts.length === 0 ? (
              <Text>Finish a workout and it will appear in your history.</Text>
            ) : undefined
          }
        >
          {isLoading ? (
            PLACEHOLDER_HISTORY_KEYS.map((key) => (
              <PlaceholderHistoryRow key={key} />
            ))
          ) : visibleWorkouts.length > 0 ? (
            // No `SwipeActions` here yet. A trailing destructive swipe used to
            // be wired to a handler that only logged, so a full swipe played the
            // whole commit animation and then sprang back — the row lied about
            // being deleted. Restoring it needs two things that do not exist:
            // a `delete` action on `useWorkoutStore`, and a product decision on
            // hard delete vs. soft delete (history feeds the user's stats).
            visibleWorkouts.map((workout) => (
              <WorkoutHistoryCard key={workout.id} workout={workout} />
            ))
          ) : (
            <EmptyRow label="No workouts yet" />
          )}
          {remainingCount > 0 ? (
            <Button
              label={`Show ${nextPageCount} More`}
              onPress={showMoreHistory}
            />
          ) : null}
        </Section>
      </List>
    </Host>
  );
};
