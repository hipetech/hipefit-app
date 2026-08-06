import { Redirect } from 'expo-router';

/**
 * A route that exists only so the Create button can be a tab bar item.
 *
 * The button is a `NativeTabs.Trigger` with `role="search"`, which is what makes
 * iOS 26 draw it as the detached circle beside the tab bar rather than as a
 * fifth item inside it. A trigger must name a route, so this is that route — and
 * it is never displayed: the trigger is `disabled`, so tapping it is prevented
 * natively and only emits `tabPress`, which opens the panel instead.
 *
 * The redirect is the guard for the one path that can still get here.
 * `disabled` suppresses the native tap, not programmatic navigation, so a deep
 * link or a stray `router.push('/create')` would otherwise land on a blank tab
 * with no way back. Sending it to Home is the honest failure mode; nothing in
 * the app links here on purpose.
 */
export default function CreateRoute() {
  return <Redirect href="/(private)/(home)" />;
}
