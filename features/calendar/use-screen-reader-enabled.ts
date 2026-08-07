import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';

/**
 * Tracks whether a screen reader (VoiceOver) is running.
 *
 * The calendar needs this because Wix branches on it: when a screen reader is
 * enabled at mount, `ExpandableCalendar` renders a plain full-month `Calendar`
 * instead of the collapsible pager (`src/expandableCalendar/index.js`, 1.1314.0),
 * and in that path nothing ever calls `onCalendarToggled`. Without reading the
 * same flag the header would hide its month title over a permanently expanded
 * month.
 *
 * Wix samples the setting once at mount and never listens for changes, so its
 * layout choice is fixed for the life of the component; this hook keeps
 * listening anyway, since the header can follow a mid-session change even when
 * the surrounding layout cannot.
 *
 * Local to the calendar: `hooks/` is for shapes with more than one feature
 * behind them, and this exists to compensate for one dependency's behaviour.
 */
export const useScreenReaderEnabled = (): boolean => {
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    let active = true;

    AccessibilityInfo.isScreenReaderEnabled().then((isEnabled) => {
      if (active) {
        setEnabled(isEnabled);
      }
    });

    const subscription = AccessibilityInfo.addEventListener(
      'screenReaderChanged',
      setEnabled
    );

    return () => {
      active = false;
      subscription.remove();
    };
  }, []);

  return enabled;
};
