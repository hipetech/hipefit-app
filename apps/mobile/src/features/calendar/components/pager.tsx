import type { CalendarExpansion } from '../hooks/use-expansion';
import type { ReactNode } from 'react';
import type { NativeScrollEvent, NativeSyntheticEvent } from 'react-native';
import { useCallback, useEffect, useRef } from 'react';
import {
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';
import Animated from 'react-native-reanimated';

import { shiftMonthStartDateId, shiftWeekStartDateId } from '../helpers/dates';
import {
  CALENDAR_MAX_WEEKS_IN_MONTH,
  CALENDAR_WEEK_HEIGHT,
} from '../helpers/metrics';
import { CalendarMonthPage, getWeekDays } from './month-page';
import { CalendarWeekRow } from './week-row';

/**
 * Three pages — previous, current, next — recentred on the middle after every
 * settle.
 *
 * **Do not reintroduce a virtualized list here.** A `FlashList` was tried and
 * removed on device evidence: it sits inside the clip, which is 48pt tall while
 * collapsed, so it measured a 48pt viewport, virtualized nearly everything out
 * of it, and re-measured every frame of the spring. That produced
 * `initialScrollIndex` landing two weeks early on cold launch, a
 * non-deterministic wrong month on first expand, a settle handler reading an
 * offset one page stale, and the grid going blank for ~430ms mid-collapse.
 * Three fixed pages are at most 126 views — below where recycling pays at all.
 */
const CURRENT_PAGE_INDEX = 1;

const styles = StyleSheet.create({
  /** `overflow: 'hidden'` is what turns the animated height into the reveal. */
  clip: {
    overflow: 'hidden',
  },
  /**
   * Fixed, never the visible month's height: the clip shortens a five-week
   * month. A self-sizing pager would re-measure through the whole animation.
   */
  monthPager: {
    height: CALENDAR_MAX_WEEKS_IN_MONTH * CALENDAR_WEEK_HEIGHT,
  },
  /**
   * The strip sits *over* the month grid's active row. Both draw the same seven
   * days at the same offset, so swapping which is visible cannot be seen.
   */
  weekOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: CALENDAR_WEEK_HEIGHT,
  },
  monthPage: {
    justifyContent: 'flex-start',
  },
  /** Visibility is binary and switched at rest, never animated. */
  live: {
    opacity: 1,
  },
  dormant: {
    opacity: 0,
  },
});

interface RollingPagerProps {
  /** `[previous, current, next]`, already in page order. */
  pages: readonly string[];
  width: number;
  /** Only the live pager scrolls and only the live pager reports. */
  isLive: boolean;
  /** `-1` or `+1`; a settle back onto the middle page reports nothing. */
  onSettle: (delta: number) => void;
  renderPage: (pageId: string) => ReactNode;
  style?: object;
}

/**
 * Reports a **delta**, not an index: the caller moves its anchor, which
 * regenerates all three pages around the new centre, and this scrolls back to
 * the middle. Invisible, because that slot now holds the page just swiped to.
 */
const RollingPager = ({
  pages,
  width,
  isLive,
  onSettle,
  renderPage,
  style,
}: RollingPagerProps) => {
  const scrollRef = useRef<ScrollView>(null);
  const currentPageId = pages[CURRENT_PAGE_INDEX];

  // Keyed on `currentPageId`, not `pages`: the array is rebuilt every render.
  useEffect(() => {
    scrollRef.current?.scrollTo({ x: width, animated: false });
  }, [currentPageId, width]);

  const handleMomentumEnd = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      // Exact, not approximate: every page is one viewport wide and paging
      // snaps, so this is an integer in practice and `Math.round` only absorbs
      // sub-pixel scale.
      const delta =
        Math.round(event.nativeEvent.contentOffset.x / width) -
        CURRENT_PAGE_INDEX;

      if (delta !== 0) onSettle(delta);
    },
    [width, onSettle]
  );

  return (
    <ScrollView
      ref={scrollRef}
      horizontal
      pagingEnabled
      showsHorizontalScrollIndicator={false}
      // The dormant pager must not scroll *or* report: it still receives
      // programmatic recentres, and a settle would overwrite the live anchor.
      scrollEnabled={isLive}
      onMomentumScrollEnd={isLive ? handleMomentumEnd : undefined}
      contentOffset={{ x: width, y: 0 }}
      style={style}
    >
      {pages.map((pageId) => (
        <View key={pageId} style={{ width }}>
          {renderPage(pageId)}
        </View>
      ))}
    </ScrollView>
  );
};

export interface CalendarPagerProps {
  /** The clip and offset styles, and which surface is currently live. */
  expansion: CalendarExpansion;
  /** Sunday of the visible week. The collapsed strip's position. */
  weekStartDateId: string;
  /** First of the visible month. The expanded grid's position. */
  monthStartDateId: string;
  onWeekChange: (weekStartDateId: string) => void;
  onMonthChange: (monthStartDateId: string) => void;
  onDayPress: (dateId: string) => void;
}

/**
 * Two pagers inside one clipped, animated-height viewport.
 *
 * **Two, despite the transition being a single clip.** Weeks stack vertically
 * inside a month grid, so clipping can never let a horizontal swipe advance the
 * strip by one week — the next week is *below*, not beside. A single month
 * pager would have to page by month even when collapsed.
 *
 * **Both stay mounted.** Rendering only the live one mounts a pager on the same
 * frame the open animation starts, which is the one frame that cannot afford
 * it. Visibility is an opacity swap, never animated.
 */
export const CalendarPager = ({
  expansion,
  weekStartDateId,
  monthStartDateId,
  onWeekChange,
  onMonthChange,
  onDayPress,
}: CalendarPagerProps) => {
  const { width } = useWindowDimensions();
  const { isMonthMounted, containerStyle, gridStyle } = expansion;

  const weekPages = [-1, 0, 1].map((offset) =>
    shiftWeekStartDateId(weekStartDateId, offset)
  );
  const monthPages = [-1, 0, 1].map((offset) =>
    shiftMonthStartDateId(monthStartDateId, offset)
  );

  const handleWeekSettle = useCallback(
    (delta: number) =>
      onWeekChange(shiftWeekStartDateId(weekStartDateId, delta)),
    [weekStartDateId, onWeekChange]
  );

  const handleMonthSettle = useCallback(
    (delta: number) =>
      onMonthChange(shiftMonthStartDateId(monthStartDateId, delta)),
    [monthStartDateId, onMonthChange]
  );

  return (
    <Animated.View style={[styles.clip, containerStyle]}>
      <Animated.View style={gridStyle} pointerEvents="box-none">
        <RollingPager
          pages={monthPages}
          width={width}
          isLive={isMonthMounted}
          onSettle={handleMonthSettle}
          style={[
            styles.monthPager,
            isMonthMounted ? styles.live : styles.dormant,
          ]}
          renderPage={(monthId) => (
            <View style={styles.monthPage}>
              <CalendarMonthPage
                monthId={monthId}
                width={width}
                onDayPress={onDayPress}
              />
            </View>
          )}
        />
      </Animated.View>
      <View
        style={styles.weekOverlay}
        pointerEvents={isMonthMounted ? 'none' : 'auto'}
      >
        <RollingPager
          pages={weekPages}
          width={width}
          isLive={!isMonthMounted}
          onSettle={handleWeekSettle}
          style={isMonthMounted ? styles.dormant : styles.live}
          renderPage={(weekStart) => (
            <CalendarWeekRow
              week={getWeekDays(weekStart)}
              dimOutsideMonth={false}
              onDayPress={onDayPress}
            />
          )}
        />
      </View>
    </Animated.View>
  );
};
