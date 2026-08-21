import type { StyleProp, ViewStyle } from 'react-native';
import type {
  AnimatedStyle,
  SharedValue,
  WithSpringConfig,
  WithTimingConfig,
} from 'react-native-reanimated';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Extrapolation,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { CALENDAR_WEEK_HEIGHT } from '../helpers/metrics';

/**
 * The spring that opens and closes the month.
 *
 * `dampingRatio: 1` is critically damped, and that is not a taste call: this
 * drives a container *height*, so any overshoot pushes the SwiftUI `List` below
 * past its resting place and pulls it back, reading as the whole page wobbling.
 * 300ms is the ceiling [ui.md](../../../docs/app/ui.md#motion) puts on motion.
 *
 * **`reduceMotion` is deliberately absent and must stay absent.** Unset, it
 * defaults to `ReduceMotion.System`, under which `withSpring` jumps straight to
 * `toValue` when the OS setting is on — so the calendar snaps correctly with no
 * branch anywhere. Do not add a `useReducedMotion()` check, and do not reach
 * for the app's `useReduceMotion()` hook: that exists for `@expo/ui`'s SwiftUI
 * `animation` modifier, which has no check of its own.
 */
const EXPANSION_SPRING: WithSpringConfig = {
  duration: 300,
  dampingRatio: 1,
};

/**
 * Paging to a month with a different week count. A timing curve, not the
 * spring: a correction to a resting layout should not read as a second open.
 */
const MONTH_CHANGE_TIMING: WithTimingConfig = { duration: 250 };

/**
 * The chevron's geometry lives here, not in
 * [expand-toggle.tsx](../components/expand-toggle.tsx), because an animated
 * style's `transform` **replaces** a static one rather than merging into it —
 * so base rotation and sweep have to be composed in one worklet to land on
 * exactly 45° and 225°.
 */
const CHEVRON_BASE_ROTATION = 45;
const CHEVRON_ROTATION_SWEEP = 180;

/** Centres the drawn corner in its 28pt row; applied after the rotation. */
const CHEVRON_NUDGE = -2;

export interface CalendarExpansionParams {
  /** 0-based index of the visible week within the visible month's grid. */
  activeWeekIndex: number;
  /** How many week rows the visible month renders (4, 5 or 6). */
  weekCount: number;
}

export interface CalendarExpansion {
  /** 0 = collapsed week strip, 1 = expanded month grid. UI thread. */
  expansion: SharedValue<number>;
  /** Intent, flipped synchronously on toggle. Drives the toggle's a11y state. */
  isExpanded: boolean;
  /** True while the month grid must stay mounted: expanded, or mid-collapse. */
  isMonthMounted: boolean;
  toggle: () => void;
  /** Animated style for the clipping container (height). */
  containerStyle: StyleProp<AnimatedStyle<ViewStyle>>;
  /** Animated style for the inner grid (translateY). */
  gridStyle: StyleProp<AnimatedStyle<ViewStyle>>;
  /** Animated style for the toggle's chevron (rotate). */
  chevronStyle: StyleProp<AnimatedStyle<ViewStyle>>;
}

/**
 * The open/close motion of the calendar, as one shared value and three styles.
 *
 * The calendar is a **clipped surface**, not a cross-fade between a week strip
 * and a month grid. One month grid is rendered inside a container with
 * `overflow: 'hidden'`; collapsed, that container is one week row tall and the
 * grid is translated up so the active week is the only row inside the window.
 * Expanded, the container is the month's full height and the grid sits at 0.
 *
 * ```
 * collapsed (expansion = 0)            expanded (expansion = 1)
 * container height = ROW_H             container height = weekCount * ROW_H
 * grid translateY  = -weekIndex*ROW_H  grid translateY  = 0
 * ```
 *
 * The active week slides *down* into its true row as the weeks above are
 * revealed — the row the user was looking at is the same physical view before,
 * during and after, so nothing can desync.
 *
 * `activeWeekIndex` and `weekCount` become shared values rather than being
 * captured in a `useAnimatedStyle` closure, which would leave the UI thread
 * animating against whichever month was visible when the closure was built.
 */
export const useCalendarExpansion = ({
  activeWeekIndex,
  weekCount,
}: CalendarExpansionParams): CalendarExpansion => {
  const collapsedOffset = -activeWeekIndex * CALENDAR_WEEK_HEIGHT;
  const expandedHeight = weekCount * CALENDAR_WEEK_HEIGHT;

  /**
   * `.get()`/`.set()` throughout, never `.value`: `react-hooks/immutability`
   * rejects assigning to `.value` on a shared value that reached a callback as
   * a hook dependency. Do not "simplify" one back to the other.
   */
  const expansion = useSharedValue(0);
  const gridOffset = useSharedValue(collapsedOffset);
  const monthHeight = useSharedValue(expandedHeight);

  const [isExpanded, setIsExpanded] = useState(false);
  const [isMonthMounted, setIsMonthMounted] = useState(false);

  /**
   * `isExpanded` in a ref, so `toggle` stays identity-stable and
   * `settleCollapse` reads the latest value, not the one the spring captured.
   */
  const expandedIntent = useRef(false);

  /**
   * Compared rather than trusted to the dependency array: the effect below also
   * re-runs on `isExpanded`, and must not re-issue a timing animation on toggle.
   */
  const writtenGeometry = useRef({ collapsedOffset, expandedHeight });

  /**
   * Paging months while open changes both numbers — a 5-week month replaced by
   * a 6-week one is 48pt appearing under the thumb — so the height is
   * retargeted with a timing animation rather than snapped.
   *
   * The grid offset is assigned outright in both cases, deliberately: at
   * `expansion` 1 it carries no weight in the interpolation, and animating it
   * would give a collapse started mid-flight a moving target.
   */
  useEffect(() => {
    const written = writtenGeometry.current;

    if (
      written.collapsedOffset === collapsedOffset &&
      written.expandedHeight === expandedHeight
    ) {
      return;
    }

    writtenGeometry.current = { collapsedOffset, expandedHeight };

    gridOffset.set(collapsedOffset);
    monthHeight.set(
      isExpanded
        ? withTiming(expandedHeight, MONTH_CHANGE_TIMING)
        : expandedHeight
    );
  }, [collapsedOffset, expandedHeight, isExpanded, gridOffset, monthHeight]);

  /**
   * `scheduleOnRN` lands on a later JS tick, so a tap that re-opens the month in
   * the gap would be undone by a stale unmount. Reading the intent ref at call
   * time, not the boolean the spring captured, is what prevents that.
   */
  const settleCollapse = useCallback(() => {
    if (!expandedIntent.current) {
      setIsMonthMounted(false);
    }
  }, []);

  /**
   * `isExpanded` flips here, not when the spring lands: a chevron and a
   * VoiceOver `expanded` state driven by the completion callback would sit
   * unchanged for the whole animation and read as a dropped tap.
   * `isMonthMounted` goes up front so the grid exists for the first frame, and
   * comes down only once a *collapse* finishes.
   *
   * `finished === false` means the spring was interrupted by the opposite
   * toggle; unmounting then would tear the grid out from under a running open.
   */
  const toggle = useCallback(() => {
    const nextExpanded = !expandedIntent.current;

    expandedIntent.current = nextExpanded;
    setIsExpanded(nextExpanded);

    if (nextExpanded) {
      setIsMonthMounted(true);
    }

    expansion.set(
      withSpring(nextExpanded ? 1 : 0, EXPANSION_SPRING, (finished) => {
        if (finished === true && !nextExpanded) {
          scheduleOnRN(settleCollapse);
        }
      })
    );
  }, [expansion, settleCollapse]);

  /**
   * **The one animated layout property in the app, deliberately.** Animating
   * `height` forces a layout pass every frame and crosses the bridge as an
   * `RNHostView` size invalidation, but that cost is the point: the list below
   * has to be *pushed down*, and a transform would slide the calendar over the
   * rows instead of moving them. Nothing else here may animate layout.
   *
   * Clamped, so an interpolation outside [0, 1] can never hand Yoga a negative
   * height.
   */
  const containerStyle = useAnimatedStyle(() => ({
    height: interpolate(
      expansion.get(),
      [0, 1],
      [CALENDAR_WEEK_HEIGHT, monthHeight.get()],
      Extrapolation.CLAMP
    ),
  }));

  /** The fast path: a transform, composited without touching layout. */
  const gridStyle = useAnimatedStyle(() => ({
    transform: [
      {
        translateY: interpolate(
          expansion.get(),
          [0, 1],
          [gridOffset.get(), 0],
          Extrapolation.CLAMP
        ),
      },
    ],
  }));

  /** Built whole here — see `CHEVRON_BASE_ROTATION` for why it cannot be split. */
  const chevronStyle = useAnimatedStyle(() => ({
    transform: [
      {
        rotate: `${CHEVRON_BASE_ROTATION + expansion.get() * CHEVRON_ROTATION_SWEEP}deg`,
      },
      { translateY: CHEVRON_NUDGE },
    ],
  }));

  return {
    expansion,
    isExpanded,
    isMonthMounted,
    toggle,
    containerStyle,
    gridStyle,
    chevronStyle,
  };
};
