---
type: flow
status: current
area: auth
updated: 2026-08-20
---

# Flow: sign in with Apple

> **This journey ships end to end.** A user can sign in with Apple, receive or recover one Firestore
> profile document, enter the protected tabs, edit profile/settings, and sign out. The login screen
> remains a developer-grade placeholder, sign-in failures are logged but not shown, and there is no
> account-deletion path.

## User goal

Enter Hipefit with an Apple ID and retain the same profile across launches. A first-time account gets
one `users/{uid}` document. A restored Firebase session checks that the same document still exists
before exposing the private app.

## Prerequisites

- Apple authentication must be available. The app requests `FULL_NAME` and `EMAIL` through
  [`expo-apple-authentication` in the auth store](../../features/auth/store/use-auth-store.ts).
- The Sign in with Apple entitlement is committed in
  [`ios/Hipefit/Hipefit.entitlements`](../../ios/Hipefit/Hipefit.entitlements).
- The selected native scheme must point at a configured Firebase project. The environment-specific
  plist is selected from the bundle identifier by
  [`ios/Hipefit/AppDelegate.swift`](../../ios/Hipefit/AppDelegate.swift); JavaScript does not select
  the Firebase environment.

The global exercise seed is not a sign-in prerequisite. Profile creation no longer reads or copies
categories. An unseeded global library produces an empty Exercises screen, not a partial profile.

## Entry points

| Entry point        | Location                                                                                 | Current behavior                                     |
| ------------------ | ---------------------------------------------------------------------------------------- | ---------------------------------------------------- |
| Cold launch        | [`app/index.tsx`](../../app/index.tsx)                                                   | Redirects according to auth state                    |
| Login route        | [`app/(public)/login.tsx`](<../../app/(public)/login.tsx>)                               | Renders `AuthScreen`; redirects if already signed in |
| Sign in with Apple | [`features/auth/index.tsx`](../../features/auth/index.tsx)                               | The only sign-in provider                            |
| Edit Profile       | [`features/settings/settings-content.tsx`](../../features/settings/settings-content.tsx) | Opens the existing route-based profile form sheet    |
| Log Out            | [`features/settings/settings-content.tsx`](../../features/settings/settings-content.tsx) | Destructive alert, then Firebase sign-out            |

There is no email/password, guest, or alternate-provider path.

## Main path

1. [`app/_layout.tsx`](../../app/_layout.tsx) calls the auth store's `initialize()`. Several routes
   and islands also call it, so the method is idempotent and only the first call installs
   `onAuthStateChanged`.
2. While Firebase restores auth, the root layout holds the route tree behind `isLoading`.
3. When auth returns a user, the callback calls `ensureUserProfile` before publishing that user to
   the auth store. Domain subscriptions and the protected tabs therefore do not start until the
   profile ensure settles.
4. For an interactive sign-in, the Apple button asks for full name and email, exchanges the Apple
   identity token for a Firebase credential, and stores the returned name long enough for the auth
   callback and explicit sign-in continuation to share it. A per-UID in-flight promise deduplicates
   those two ensure calls.
5. `ensureUserProfile` reads `users/{uid}` through `userRef(uid)`.
6. If the document is missing, `createUserProfile` validates and writes exactly one document with
   `setDoc`. There is no batch and no user category copy.
7. If the document exists, the decoder validates it. Missing Apple name fields and an empty display
   name are filled only when Apple supplied values. A schema version below the current version is
   advanced. Existing non-empty user-edited names are not overwritten.
8. The auth store publishes `user`, `isLoggedIn: true`, and `isLoading: false`. The protected tree
   mounts, and [`database/use-firestore-subscriptions.ts`](../../database/use-firestore-subscriptions.ts)
   starts the user and exercise stores.
9. [`app/index.tsx`](../../app/index.tsx) redirects to Home. Surfaces backed by live stores manage
   their own loading presentation; Home limits profile redaction to its header.

The profile ensure also runs for a restored session. If the document was deleted while the Firebase
session survived, launch recreates it before the app reports the user signed in. This is self-healing
for a missing document, not a general repair mechanism: an existing malformed profile is logged by
the decoder and is not replaced.

## First profile shape

The one profile document is created with:

- Apple/Firebase identity fields and an editable `displayName`;
- `body.birthDate: null`, `body.heightCm: null`, and `purpose: null`;
- `settings.theme: system`, `language: en`, `units: metric`, and empty hidden exercise/category ref
  arrays;
- `schemaVersion: 1`;
- server timestamps for `createdAt` and `updatedAt`.

There is no `stats` map. Home's workout count and streaks remain at zero while workout persistence is
disconnected. There are no
notification, reminder, or auto-pause settings in the document.

Apple normally returns the person's name only on the first authorization. A Firebase/Auth wipe does
not reset that Apple authorization. A recreated profile may therefore start with empty names unless
the user revokes Hipefit under Sign in with Apple before signing in again; Edit Profile remains the
in-app recovery path.

## Profile and settings controls

The existing Edit Profile form sheet in
[`features/settings/edit-profile-form.tsx`](../../features/settings/edit-profile-form.tsx) now saves:

- display name;
- optional birth date as a real, non-future `YYYY-MM-DD`;
- optional height in centimeters or inches, according to the units setting;
- optional free-text training purpose;
- optional new weight in kilograms or pounds, according to the units setting.

Weight is not a field on the profile document. The form displays `currentWeight` from the newest
measurement listener and, when a new value is entered, appends one
`users/{uid}/bodyMeasurements/{id}` document recorded at the current time. It is a single field group
inside Edit Profile, not a route or independent weigh-in journey. No note, backdate, history, chart,
edit, or delete UI ships.

Saving profile fields and appending a weigh-in are sequential writes rather than one atomic batch.
If the profile update succeeds and the measurement write fails, the sheet reports a save failure even
though the profile portion has already persisted.

Settings now includes native menu pickers for Theme, Language, and Units:

- Language writes `settings.language` as `en` or `uk`. Exercise, category, and equipment names
  recompute immediately from subscribed locale maps. The surrounding app chrome remains English.
- Units writes `settings.units` as `metric` or `imperial`. Stored values remain canonical in
  kilograms and centimeters; profile entry/display and workout volume convert at the UI boundary.
- A failed settings write displays an error footer in the App section.

## Signing out

1. Log Out presents a destructive SwiftUI alert.
2. Confirmation calls Firebase `signOut`.
3. `onAuthStateChanged` publishes `null`.
4. The central subscription effect calls both store teardowns. Seven Firestore listeners detach,
   and each store clears its state back to loading defaults.
5. `<Stack.Protected>` removes the private tree, and the entry redirect returns to `/login`.

No profile, measurement, template, workout, or Auth user is deleted by sign-out.

## Alternative and error paths

- Apple Sign-In unavailable: the store warns and returns; the screen shows no explanation.
- User cancels Apple's sheet: cancellation is logged and rethrown, then swallowed by the screen.
- Missing identity token or Firebase failure: logged, rethrown, and swallowed; there is no error UI.
- Missing profile on any authenticated callback: recreated as one default document.
- Malformed existing profile: logged and left in place; the user can enter the private app with
  `profile: null`, so screens use their fallbacks.
- Firestore profile or measurement listener failure: logged and presented like missing/empty data.
- Profile save failure: the Edit Profile sheet stays open and shows a connection-oriented error.
- Sign-out failure: logged by the store and Settings; the user remains signed in with no user-facing
  explanation.

## Completion state

After successful sign-in, Firebase Auth holds the session, one valid `users/{uid}` document exists,
the two domain stores are subscribed, and the protected tab tree is visible. No global category data
was copied and no user subcollection was created unless the user saved a weigh-in.

After sign-out, Auth state is null, data listeners and in-memory user data are cleared, and the login
route is visible. Server data remains unchanged. There is still no account erasure or Apple credential
revocation flow.
