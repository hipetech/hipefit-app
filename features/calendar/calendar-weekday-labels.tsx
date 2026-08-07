import { StyleSheet, View } from 'react-native';

import { colors } from '@/theme/colors';
import { Text } from '@/ui/text';

import { getWeekdayLabels } from './calendar-helpers';

/**
 * Read once at module scope: the labels depend only on the device locale, which
 * does not change without an app restart, and rebuilding seven
 * `toLocaleDateString` calls on every header render would be pure waste.
 */
const WEEKDAY_LABELS = getWeekdayLabels();

const styles = StyleSheet.create({
  /**
   * `flex: 1` because this is handed to the library's `renderHeader`, which
   * drops it into a row beside its (hidden) month arrows — without it the
   * labels hug their own width and stop lining up with the columns below.
   */
  row: {
    flex: 1,
    flexDirection: 'row',
    paddingBottom: 4,
  },
  /**
   * `flex: 1` per column, matching Wix's own `dayContainer`, so a label sits
   * over the centre of its column in both the week strip and the month grid.
   */
  label: {
    flex: 1,
    textAlign: 'center',
    color: colors.secondaryLabel,
  },
});

/**
 * The `Sun` … `Sat` row above the calendar.
 *
 * Its own component because it replaces Wix's `WeekDaysNames`, which renders
 * with `allowFontScaling={false}`; these labels scale on the `footnote` ramp
 * like every other secondary caption in the app.
 *
 * Hidden from VoiceOver: each day cell already announces its own weekday, so
 * these would be seven redundant focus stops before the calendar proper.
 */
export const CalendarWeekdayLabels = () => (
  <View style={styles.row} accessibilityElementsHidden>
    {WEEKDAY_LABELS.map((label) => (
      <Text key={label} variant="footnote" style={styles.label}>
        {label}
      </Text>
    ))}
  </View>
);
