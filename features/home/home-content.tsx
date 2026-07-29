import type { WithId, Workout } from '@/database';
import { Host } from '@expo/ui';
import {
  Button,
  HStack,
  Image,
  Label,
  LabeledContent,
  List,
  Section,
  Spacer,
  Text,
  VStack,
} from '@expo/ui/swift-ui';
import {
  Animation,
  animation,
  contentTransition,
  font,
  monospacedDigit,
  padding,
} from '@expo/ui/swift-ui/modifiers';

import { useRoutineStore } from '@/features/routines/store/use-routine-store';
import { useUserStore } from '@/features/user/store/use-user-store';
import { useWorkoutStore } from '@/features/workouts/store/use-workout-store';
import { useAppColorScheme } from '@/hooks/use-app-color-scheme';
import { useReduceMotion } from '@/hooks/use-reduce-motion';
import { formatDuration, formatRelativeDate } from '@/lib/format';
import { colors } from '@/theme/colors';
import { mods } from '@/theme/modifiers';
import { layout } from '@/theme/styles';

/** One row of the "Recent Workouts" section, already formatted for display. */
interface RecentWorkoutRow {
  id: string;
  title: string;
  /** "45 min · 6 exercises" */
  meta: string;
  dateLabel: string;
  isCompleted: boolean;
}

/** The single highlighted routine, already formatted for display. */
interface FeaturedRoutine {
  name: string;
  description: string | null;
  /** "6 exercises · 45 min" */
  meta: string;
}

const toRecentWorkoutRow = (workout: WithId<Workout>): RecentWorkoutRow => ({
  id: workout.id,
  title: workout.data.routineName ?? 'Quick Workout',
  meta: `${formatDuration(workout.data.duration)} · ${workout.data.totalExercises} exercises`,
  dateLabel: formatRelativeDate(workout.data.startedAt),
  isCompleted: workout.data.status === 'completed',
});

/**
 * How an Activity figure rolls to its new value.
 *
 * 250ms of ease-in-out: fast enough that it reads as the number *settling*
 * rather than as an effect, and comfortably inside the ~300ms budget the rest
 * of the app's motion works to. Apple's `Animation.default` is roughly 350ms,
 * which is noticeably draggy on a three-row stat block.
 */
const COUNTER_ANIMATION = Animation.easeInOut({ duration: 0.25 });

/**
 * The static half of an Activity value's modifiers — see `counterModifiers`
 * below for why the motion modifiers are appended rather than baked in here.
 */
const COUNTER_BASE_MODIFIERS = [font({ textStyle: 'body' }), monospacedDigit()];

/**
 * Modifiers for one Activity value.
 *
 * `font` then `monospacedDigit` is the Phase 2.5 order and is load-bearing
 * (index 0 is innermost, so the digit variant *refines* the resolved font
 * instead of being overwritten by it). The two motion modifiers are appended
 * **after** those, i.e. outermost: `contentTransition('numericText')` marks the
 * text as a rolling odometer, and `animation` supplies the transaction that
 * actually drives it — without the latter the transition never runs.
 *
 * `animated` is false while the stores load and whenever Reduce Motion is on,
 * which drops both modifiers entirely rather than animating to zero duration.
 * Gating on load matters for more than taste: applying `.animation(_:value:)`
 * for the first time never animates, so introducing it at the moment redaction
 * lifts is what stops the placeholder figures from visibly rolling into the
 * real ones. It also leaves the redacted modifier arrays byte-identical to what
 * they were before, so nothing about the measured placeholder widths shifts.
 */
const counterModifiers = (value: number, animated: boolean) =>
  animated
    ? [
        ...COUNTER_BASE_MODIFIERS,
        contentTransition('numericText'),
        animation(COUNTER_ANIMATION, value),
      ]
    : COUNTER_BASE_MODIFIERS;

/**
 * Realistic stand-ins rendered behind `redacted('placeholder')` while the
 * stores load. Redaction needs real structure with plausible string lengths —
 * there is deliberately no separate skeleton tree and no early return.
 */
const PLACEHOLDER_STATS = {
  totalWorkouts: 12,
  currentStreak: 3,
  longestStreak: 9,
};

const PLACEHOLDER_ROUTINE: FeaturedRoutine = {
  name: 'Placeholder Routine',
  description: 'A short routine description',
  meta: '6 exercises · 45 min',
};

const PLACEHOLDER_WORKOUTS: RecentWorkoutRow[] = [
  {
    id: 'placeholder-1',
    title: 'Placeholder Workout',
    meta: '45 min · 6 exercises',
    dateLabel: 'Yesterday',
    isCompleted: true,
  },
  {
    id: 'placeholder-2',
    title: 'Another Workout',
    meta: '38 min · 5 exercises',
    dateLabel: '3 days ago',
    isCompleted: true,
  },
  {
    id: 'placeholder-3',
    title: 'Morning Session',
    meta: '52 min · 8 exercises',
    dateLabel: '5 days ago',
    isCompleted: true,
  },
];

const FEATURED_STACK_MODIFIERS = [padding({ vertical: 4 })];

const RECENT_ROW_MODIFIERS = [padding({ vertical: 2 })];

/**
 * Body of the Home screen.
 *
 * The component reads its stores itself and takes no props, so the route file
 * stays thin (title + this island).
 *
 * One `Host` filling the screen (`flex: 1`, deliberately **no**
 * `matchContents`) around one SwiftUI `List` with `listStyle('insetGrouped')`.
 * This replaces the nine separate `Host` islands the screen used to mount. A
 * `List` has no intrinsic content height, so it can only live at the root of a
 * Host that owns real space — nesting it in an RN `ScrollView`, or measuring it
 * with `matchContents`, renders nothing. `insetGrouped` supplies the 16pt
 * margins, 44pt row heights, inset hairlines and grouped background for free,
 * which is why every hand-rolled width/padding/gap constant is gone.
 *
 * The greeting is not in the body: it is the screen's large navigation title
 * (see the route file), the way Apple's own Home app renders "Good Evening".
 */
export const HomeContent = () => {
  const colorScheme = useAppColorScheme();
  const reduceMotion = useReduceMotion();
  const { profile, isLoading: userLoading } = useUserStore();
  const { recentWorkouts, isLoading: workoutsLoading } = useWorkoutStore();
  const { activeRoutines, isLoading: routinesLoading } = useRoutineStore();

  const isLoading = userLoading || workoutsLoading || routinesLoading;
  const stats = profile?.stats;

  // Each figure is kept as a number and formatted at the call site, because
  // `animation` is driven by the value itself (the native side accepts only a
  // number or a boolean) and it has to be the *same* number the label shows.
  const totalWorkouts = isLoading
    ? PLACEHOLDER_STATS.totalWorkouts
    : (stats?.totalWorkouts ?? 0);
  const currentStreak = isLoading
    ? PLACEHOLDER_STATS.currentStreak
    : (stats?.currentStreak ?? 0);
  const longestStreak = isLoading
    ? PLACEHOLDER_STATS.longestStreak
    : (stats?.longestStreak ?? 0);

  const animateCounters = !isLoading && !reduceMotion;

  const routine = activeRoutines[0];
  const featuredRoutine: FeaturedRoutine | null = isLoading
    ? PLACEHOLDER_ROUTINE
    : routine
      ? {
          name: routine.data.name,
          description: routine.data.description,
          meta: routine.data.estimatedDuration
            ? `${routine.data.exercises.length} exercises · ${formatDuration(routine.data.estimatedDuration * 60)}`
            : `${routine.data.exercises.length} exercises`,
        }
      : null;

  const recentRows: RecentWorkoutRow[] = isLoading
    ? PLACEHOLDER_WORKOUTS
    : recentWorkouts.map(toRecentWorkoutRow);

  return (
    <Host style={layout.groupedScreen} colorScheme={colorScheme}>
      <List
        modifiers={
          isLoading ? mods.listInsetGroupedRedacted : mods.listInsetGrouped
        }
      >
        {/*
          Stats are label + value rows rather than a tile grid: the same three
          numbers already render this way in Settings, and a full-bleed grid row
          would reintroduce the width math `List` exists to delete.

          These three values are the screen's only true counters: they are
          standalone figures, they stack in one trailing column, and they change
          in place as workouts are logged — the store is a live Firestore
          subscription, so finishing a workout moves all three while this screen
          is on top. `monospacedDigit()` stops the column from twitching as the
          digits swap; `numericText` + `animation` (see `counterModifiers`) rolls
          the new digit in the way Fitness and Activity do rather than hard-
          cutting it. This is the only place in the app that gets that treatment.
        */}
        <Section title="Activity">
          <LabeledContent
            label={
              <Label
                title="Workouts"
                systemImage="figure.strengthtraining.traditional"
              />
            }
          >
            <Text modifiers={counterModifiers(totalWorkouts, animateCounters)}>
              {String(totalWorkouts)}
            </Text>
          </LabeledContent>
          <LabeledContent
            label={<Label title="Current Streak" systemImage="flame.fill" />}
          >
            <Text modifiers={counterModifiers(currentStreak, animateCounters)}>
              {`${currentStreak} days`}
            </Text>
          </LabeledContent>
          <LabeledContent
            label={<Label title="Longest Streak" systemImage="trophy.fill" />}
          >
            <Text modifiers={counterModifiers(longestStreak, animateCounters)}>
              {`${longestStreak} days`}
            </Text>
          </LabeledContent>
        </Section>

        {/*
          Empty sections are a plain secondary-label row plus a `Section`
          footer, never a `ContentUnavailableView`. `ContentUnavailableView` is
          a *whole-view* treatment ("there is nothing on this screen"); Home
          always renders real Activity data, so it is never in that state, and
          dropping one into a row just re-creates the tall centred empty card
          this migration deleted. Apple's own grouped lists (Settings, Wallet,
          Health) say "None"/"No Data" in a normal 44pt row and put the "what to
          do next" sentence in the section footer — which is exactly what the
          footer is for.
        */}
        <Section
          title="Featured Routine"
          footer={
            featuredRoutine ? undefined : (
              <Text>
                Create a routine in the Workouts tab and it will be featured
                here.
              </Text>
            )
          }
        >
          {featuredRoutine ? (
            <>
              <VStack
                alignment="leading"
                spacing={4}
                modifiers={FEATURED_STACK_MODIFIERS}
              >
                <Text modifiers={mods.headlineLabel}>
                  {featuredRoutine.name}
                </Text>
                {featuredRoutine.description ? (
                  <Text modifiers={mods.subheadlineSecondary}>
                    {featuredRoutine.description}
                  </Text>
                ) : null}
                {/*
                  No `monospacedDigit()` here, unlike the Activity values
                  above: this is a descriptive sentence fragment ("6 exercises
                  · 45 min") that never updates in place and has nothing to
                  align against. Fixed-width digits inside running text read as
                  a typographic mistake — reserve them for standalone figures.
                */}
                <Text modifiers={mods.footnoteSecondary}>
                  {featuredRoutine.meta}
                </Text>
              </VStack>
              {/*
                Left-aligned tinted action row — Apple's list idiom for a
                non-destructive action (centered labels are for destructive
                confirms). `disabled(true)` until the workout player lands:
                without an `onPress` the row would still light up on touch and
                promise something it cannot deliver. Drop the modifier and add
                `onPress` in the same commit that ships the player.
              */}
              <Button
                label="Start Workout"
                systemImage="play.fill"
                modifiers={mods.disabledOnly}
              />
            </>
          ) : (
            <Text modifiers={mods.bodySecondary}>No Active Routines</Text>
          )}
        </Section>

        <Section
          title="Recent Workouts"
          footer={
            recentRows.length === 0 ? (
              <Text>Finish your first workout and it will appear here.</Text>
            ) : undefined
          }
        >
          {recentRows.length > 0 ? (
            recentRows.map((row) => (
              <HStack
                key={row.id}
                spacing={12}
                alignment="center"
                modifiers={RECENT_ROW_MODIFIERS}
              >
                <Image
                  systemName={
                    row.isCompleted ? 'checkmark.circle.fill' : 'xmark.circle'
                  }
                  color={
                    row.isCompleted ? colors.systemGreen : colors.systemOrange
                  }
                  modifiers={mods.title3}
                />
                <VStack alignment="leading" spacing={2}>
                  <Text modifiers={mods.bodyLabel}>{row.title}</Text>
                  {/* Same reasoning as the Featured Routine meta line: a
                      subtitle sentence, not a figure. */}
                  <Text modifiers={mods.footnoteSecondary}>{row.meta}</Text>
                </VStack>
                <Spacer />
                {/* "Yesterday" / "3 days ago" — prose, and already flush right
                    via the `Spacer`, so fixed-width digits buy no alignment. */}
                <Text modifiers={mods.footnoteSecondary}>{row.dateLabel}</Text>
              </HStack>
            ))
          ) : (
            <Text modifiers={mods.bodySecondary}>No Recent Workouts</Text>
          )}
        </Section>
      </List>
    </Host>
  );
};
