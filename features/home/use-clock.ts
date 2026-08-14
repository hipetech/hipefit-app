import { useEffect, useState } from 'react';
import { AppState } from 'react-native';

import { getGreeting, toLocalDateId } from '@/lib/format';

/** The hours at which `getGreeting()` changes its answer. */
const BOUNDARY_HOURS = [12, 18] as const;

/**
 * Milliseconds until the next boundary (12:00, 18:00, or the next midnight).
 * Used to schedule exactly one timer per boundary instead of polling.
 */
const msUntilNextBoundary = (now: Date): number => {
  const next = new Date(now);
  next.setMinutes(0, 0, 0);

  const hour = now.getHours();
  const upcoming = BOUNDARY_HOURS.find((boundary) => hour < boundary);
  // `setHours(24)` normalises to 00:00 tomorrow.
  next.setHours(upcoming ?? 24);

  // Clamp so a clock change or a DST jump can never schedule a busy loop.
  return Math.max(next.getTime() - now.getTime(), 1000);
};

export interface HomeClock {
  /** "Good Morning" / "Good Afternoon" / "Good Evening". */
  greeting: string;
  /** Today, as a local `YYYY-MM-DD` day ID. */
  todayDateId: string;
}

/**
 * The two time-derived values in Home's header, driven by one timer.
 *
 * Computing either once during render goes stale in two ways: the app sits open
 * across a boundary, or it is backgrounded overnight and resumed. Both are
 * covered here without a per-second timer — a single `setTimeout` is armed for
 * the *next* boundary only, and both values are re-read whenever `AppState`
 * returns to `active` (iOS suspends timers in the background, so the timer
 * alone cannot be trusted across a resume).
 *
 * Midnight is already one of the boundaries the greeting needs, so the date
 * rides along on the same schedule rather than arming a second timer. Both are
 * held as strings so the same-value `setState` bail-out applies: the 12:00 and
 * 18:00 ticks leave the date untouched and re-render nothing.
 */
export const useHomeClock = (): HomeClock => {
  const [greeting, setGreeting] = useState(getGreeting);
  const [todayDateId, setTodayDateId] = useState(() =>
    toLocalDateId(new Date())
  );

  useEffect(() => {
    let timeout: ReturnType<typeof setTimeout>;

    const sync = () => {
      const now = new Date();

      setGreeting(getGreeting());
      setTodayDateId(toLocalDateId(now));
      timeout = setTimeout(sync, msUntilNextBoundary(now));
    };

    sync();

    const subscription = AppState.addEventListener('change', (state) => {
      if (state !== 'active') return;
      clearTimeout(timeout);
      sync();
    });

    return () => {
      clearTimeout(timeout);
      subscription.remove();
    };
  }, []);

  return { greeting, todayDateId };
};
