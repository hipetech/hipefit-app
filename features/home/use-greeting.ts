import { useEffect, useState } from 'react';
import { AppState } from 'react-native';

import { getGreeting } from '@/lib/format';

/** The hours at which `getGreeting()` changes its answer. */
const BOUNDARY_HOURS = [12, 18] as const;

/**
 * Milliseconds until the next greeting boundary (12:00, 18:00, or the next
 * midnight). Used to schedule exactly one timer per boundary instead of polling.
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

/**
 * The time-of-day greeting ("Good Morning" / "Good Afternoon" / "Good Evening"),
 * kept fresh while the screen stays mounted.
 *
 * Computing it once during render goes stale in two ways: the app sits open
 * across 12:00 or 18:00, or it is backgrounded overnight and resumed. Both are
 * covered here without a per-second timer — a single `setTimeout` is armed for
 * the *next* boundary only, and the value is re-read whenever `AppState`
 * returns to `active` (iOS suspends timers in the background, so the timer
 * alone cannot be trusted across a resume).
 */
export const useGreeting = (): string => {
  const [greeting, setGreeting] = useState(getGreeting);

  useEffect(() => {
    let timeout: ReturnType<typeof setTimeout>;

    const sync = () => {
      // A same-value `setState` bails out, so this does not re-render unless
      // the greeting actually changed.
      setGreeting(getGreeting());
      timeout = setTimeout(sync, msUntilNextBoundary(new Date()));
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

  return greeting;
};
