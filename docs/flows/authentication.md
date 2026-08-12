---
type: flow
status: current
area: auth
updated: 2026-08-12
---

# Flow: sign in with Apple

> **This journey ships end to end** — a first-time user can sign in, get a Firestore profile, and
> land in the tab bar; a returning user skips straight past the login route; and Log Out in Settings
> returns them to it. Two things are worth knowing before reading further: the unauthenticated
> screen is a **developer-grade placeholder** (the words "Not Logged In" above a system Apple
> button), and **a failed sign-in shows the user nothing** — the error is logged to the console and
> swallowed. There is also no account-deletion path anywhere in the app.

## User goal

Get into the app with an Apple ID and stay in it. After the first sign-in the user has a Firebase
account, a `users/{uid}` profile document with default settings and zeroed stats, and their own copy
of the default exercise groups; on every later launch they are simply already signed in.

## Prerequisites

- **A real device or simulator signed into an Apple ID.** Sign-in goes through
  `expo-apple-authentication`, driven entirely from
  [`use-auth-store.ts`](../../features/auth/store/use-auth-store.ts), and the store checks
  `AppleAuthentication.isAvailableAsync()` first — if it returns false the sign-in handler
  `console.warn`s and returns without doing anything.
- **The Sign in with Apple capability**, declared in
  [`ios/Hipefit/Hipefit.entitlements`](../../ios/Hipefit/Hipefit.entitlements). This is a bare
  workflow, so the entitlement lives in the committed native project, not in a config plugin — see
  [`docs/app/architecture.md`](../app/architecture.md).
- **A Firebase project for the running environment.** All three `GoogleService-Info-*.plist` files
  are bundled into every target; the choice is made **at launch, natively**, by
  [`ios/Hipefit/AppDelegate.swift`](../../ios/Hipefit/AppDelegate.swift), which switches on the
  bundle identifier (`.development` → dev, `.staging` → stage, anything else → prod) and calls
  `FirebaseApp.configure` with that plist. The Xcode scheme — and therefore the bundle identifier —
  is what the `ios:development` / `ios:staging` / `ios:production` scripts in
  [`package.json`](../../package.json) select.
- **The global `exerciseGroups` collection must be seeded**, because first-time profile creation
  copies it. Nothing in the app writes it; it comes from
  [`scripts/db/seed-exercises.ts`](../../scripts/db/seed-exercises.ts), run as
  `bun run db:seed --seed exercises` (the CLI in
  [`scripts/db/index.ts`](../../scripts/db/index.ts) exits with an error if `--seed` is missing).
  Against an unseeded project sign-in still succeeds and the new user simply gets **zero** exercise
  groups. The Exercises tab still lists the global catalogue — it filters by search text and
  difficulty, not by group — but every row falls back to the raw global `groupKey` as its group
  label, because the merge in
  [`use-exercise-store.ts`](../../features/exercises/store/use-exercise-store.ts) resolves names
  through the user's own group copies.

## Entry points

| Entry point                   | Where                                                                                    | Notes                                                                                                           |
| ----------------------------- | ---------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| **Cold launch**               | [`app/index.tsx`](../../app/index.tsx)                                                   | The entry route renders nothing but a redirect: `/(private)/(home)` when signed in, `/(public)/login` when not. |
| **`/login` route**            | [`app/(public)/login.tsx`](<../../app/(public)/login.tsx>)                               | Renders `AuthScreen`; redirects to `(private)` itself if the session is already live.                           |
| **Sign in with Apple button** | [`features/auth/index.tsx`](../../features/auth/index.tsx)                               | The system `AppleAuthenticationButton`, `SIGN_IN` type, `WHITE` style, 8pt radius. The only real control.       |
| **Log Out in Settings**       | [`features/settings/settings-content.tsx`](../../features/settings/settings-content.tsx) | Destructive row behind an `Alert` confirm; the exit half of this flow.                                          |

There is no email/password form, no other provider, and no "continue as guest" path. Apple Sign-In
is the entire authentication surface.

## Main path

1. **The app launches.** [`app/_layout.tsx`](../../app/_layout.tsx) calls `useAuthStore().initialize()`
   in an effect and renders an empty `layout.centeredScreen` view while `isLoading` is true. Note
   that `initialize` is called from four places — the root layout, `app/index.tsx`,
   `app/(public)/login.tsx`, and `AuthScreen` itself — so the store guards it: the first call
   installs the `onAuthStateChanged` listener and every later call returns a no-op teardown. The
   comment in [`use-auth-store.ts`](../../features/auth/store/use-auth-store.ts) records the bug that
   made the guard necessary (each call used to overwrite the shared `unsubscribe` slot, leaking the
   previous listener).
2. **Firebase resolves the persisted session.** The first `onAuthStateChanged` callback sets `user`,
   `isLoggedIn`, and `isLoading: false` in one write. Until it fires, nothing below the root layout
   mounts.
3. **The entry redirect runs.** [`app/index.tsx`](../../app/index.tsx) sends a signed-in user to
   `/(private)/(home)` and everyone else to `/(public)/login`. The redirect is belt-and-braces on top
   of the real gate: `app/_layout.tsx` wraps the `(private)` screen in
   `<Stack.Protected guard={isLoggedIn}>`, so the private tree is absent from the navigator entirely
   while signed out. See [`docs/app/navigation.md`](../app/navigation.md).
4. **The user taps Sign in with Apple.** [`features/auth/index.tsx`](../../features/auth/index.tsx)
   calls the store's `signInWithApple`, which requests the `FULL_NAME` and `EMAIL` scopes through
   `AppleAuthentication.signInAsync()`.
5. **The Apple credential is exchanged for a Firebase one.** The identity token goes into an
   `OAuthProvider('apple.com')` credential and then `signInWithCredential` — all inside
   [`use-auth-store.ts`](../../features/auth/store/use-auth-store.ts). A missing `identityToken`
   throws before this point.
6. **`onAuthStateChanged` fires with the new user**, flipping `isLoggedIn`. This happens _before_
   step 7 finishes, so navigation into `(private)` and profile creation race — see
   [First sign-in vs. returning session](#first-sign-in-vs-returning-session).
7. **`ensureUserProfile` reads `users/{uid}`.** If the document does not exist, `createUserProfile`
   writes it in a single `writeBatch` together with one `users/{uid}/exerciseGroups` document per
   global group (`isDefault: true`, `globalGroupId` pointing back at the original). If it does
   exist and Apple returned a name, only the name fields and `updatedAt` are patched with
   `updateDoc`.
8. **The subscriptions come up.** [`database/use-firestore-subscriptions.ts`](../../database/use-firestore-subscriptions.ts)
   watches `useAuthStore.user` and, on the transition to non-null, calls `subscribe(uid)` on the
   user, exercise, workout, and routine stores in that order. It is mounted once, in
   [`app/_layout.tsx`](../../app/_layout.tsx); no screen fetches on its own.
9. **The tab bar renders.** `(private)` mounts its four tabs from
   [`app/(private)/_layout.tsx`](<../../app/(private)/_layout.tsx>). Screens show their redacted
   placeholder state until the first snapshot arrives — the same loading treatment described in
   [`start-workout.md`](start-workout.md).
10. **Home and Settings render the profile identity.** When `photoURL` is present,
    [`Avatar`](../../features/avatar/avatar.tsx) crops that image into a circle. Otherwise it shows
    the first and final initials over a deterministic gradient selected from the Firebase uid, so
    editing the display name does not unexpectedly recolor it. The component accepts the stored URI,
    but there is no photo picker or upload path in the app.
11. **The user's theme takes effect.** [`hooks/use-app-color-scheme.ts`](../../hooks/use-app-color-scheme.ts)
    reads `profile.settings.theme` from the user store, and the root layout applies it with
    `Appearance.setColorScheme`. Before the profile snapshot lands, the hook returns `undefined`,
    i.e. follow the device — so a user whose saved theme differs from the system one sees a brief
    switch after sign-in.

## First sign-in vs. returning session

The two cases diverge only at step 7, and the difference is worth stating because the code reads as
one path:

- **First sign-in ever.** Apple returns `fullName` **only on the first authorization for this app**;
  `createUserProfile` builds `displayName` from it, falls back to the Firebase `displayName`, and
  finally to an empty string. It also writes the default `settings` (metric, system theme, English,
  notifications on, reminders off, auto-pause on) and zeroed `stats`. Those literals live in
  [`use-auth-store.ts`](../../features/auth/store/use-auth-store.ts) and are the only place in the
  app that creates a `UserProfile`.
- **Signing in again on a new install.** The document already exists, so nothing is recreated. If
  Apple happens to return a name it is patched in; usually it does not, and the existing profile is
  left alone. When it does, the patch **recomputes `displayName` from the Apple name**, so it
  overwrites whatever the user had set in Edit Profile
  ([`features/settings/edit-profile-form.tsx`](../../features/settings/edit-profile-form.tsx)).
- **Returning launch with a live session.** `signInWithApple` never runs. Firebase restores the
  session natively, `onAuthStateChanged` fires with a user, and the flow starts at step 3 — meaning
  `ensureUserProfile` is **not** on the launch path. Nothing repairs a `users/{uid}` document that
  is deleted server-side while a session is live; the app runs with `profile: null` until the user
  signs out and back in.
- **The creation race.** Because `isLoggedIn` flips at step 6 while step 7 is still awaiting
  Firestore, a brand-new user reaches the tab bar before their profile document exists. The user
  store's snapshot handler treats a non-existent document as `profile: null, isLoading: false`
  ([`features/user/store/use-user-store.ts`](../../features/user/store/use-user-store.ts)), so
  Settings briefly shows the `'User'` / `'No email'` fallbacks rather than a placeholder. The batch
  commit then arrives over the live listener and the real values replace them. No spinner covers
  this window.

## Signing out

1. **Log Out** in [`features/settings/settings-content.tsx`](../../features/settings/settings-content.tsx)
   opens a SwiftUI `Alert` with Cancel and a destructive Log Out — a destructive confirm is an alert
   on iOS, never a sheet, and the component says so.
2. Confirming calls the store's `signOut`, which is `signOut(getAuth())` and nothing else. A failure
   is logged twice and surfaced nowhere: the store logs and rethrows, and `SettingsContent` catches
   it and logs again with a `[Settings] logout` prefix.
3. `onAuthStateChanged` fires with `null`; the store sets `user: null`, `isLoggedIn: false`.
4. `useFirestoreSubscriptions` runs its effect cleanup: each store's teardown detaches its listeners
   **and clears its state back to `isLoading: true`** — that clearing lives inside the closure
   returned by `subscribe`, in all four stores. Every store also exposes a `reset()`; **nothing calls
   it**, in the app or in the seed scripts.
5. No app code navigates. `isLoggedIn` flips false, `<Stack.Protected>` drops `(private)` out of the
   route tree, and the app lands back on the entry redirect, which sends it to `/(public)/login`.
   The only imperative navigation in the whole app is the two Settings calls (`router.push` to
   `/settings/edit-profile` and `router.back()` in the form).

## What is missing

- **No error UI on failure.** `signInWithApple` rethrows after logging; `AuthScreen`'s `handleSignIn`
  catches and does nothing ("Error is already logged in the store"). A network failure, a revoked
  credential, and a Firebase rejection are all indistinguishable from a mis-tap.
- **No account deletion and no credential-revocation handling.** There is no `deleteUser` call, no
  `AppleAuthentication.addRevokeListener`, and no `getCredentialStateAsync` check anywhere in
  `app/`, `features/`, `database/`, or `lib/`.
- **The login screen is a placeholder.** No app name, icon, or value proposition — just a bold
  "Not Logged In" label above the Apple button. Its `isLoggedIn` branch (a "Logged In" label plus a
  Sign Out button) is effectively dead: `app/(public)/login.tsx` redirects before that state can be
  rendered.
- **No analytics or Crashlytics on the auth path.** Both packages are installed, but there is no
  `getAnalytics`/`getCrashlytics` call in application code, so sign-in success and failure are not
  recorded anywhere but the console.
- **`features/auth/index.tsx` is the last bare `index.tsx` island** in `features/` — legacy, not the
  pattern to copy for new features.

## Screens, routes, and data involved

- **Routes:** `/` ([`app/index.tsx`](../../app/index.tsx), pure redirect),
  `/login` ([`app/(public)/login.tsx`](<../../app/(public)/login.tsx>)), and the protected
  `(private)` subtree gated in [`app/_layout.tsx`](../../app/_layout.tsx). Sign-out re-enters at `/`.
  Both public routes are declared `headerShown: false`.
- **Islands:** `AuthScreen` ([`features/auth/index.tsx`](../../features/auth/index.tsx)) and, for the
  exit, `SettingsContent` ([`features/settings/settings-content.tsx`](../../features/settings/settings-content.tsx))
  mounted from [`app/(private)/settings/index.tsx`](<../../app/(private)/settings/index.tsx>).
- **Documents:** `UserProfile` (with embedded `UserSettings` and `UserStats`) at `users/{uid}` and
  `UserExerciseGroup` at `users/{uid}/exerciseGroups/{groupId}`, both in
  [`database/types.ts`](../../database/types.ts) with their refs in
  [`database/refs.ts`](../../database/refs.ts) and their field-level documentation in
  [`docs/db-structure.md`](../db-structure.md). Access is scoped by
  [`firestore.rules`](../../firestore.rules): global `exercises` and `exerciseGroups` are readable by
  any authenticated user and writable by nobody; everything under `users/{userId}` requires
  `request.auth.uid == userId`.

## State and data changes

Reads:

- `useAuthStore` holds `user`, `isLoggedIn`, `isLoading` — the only store not driven by
  `use-firestore-subscriptions.ts`, because it owns the listener the others key off.
- The four Firestore stores each attach on sign-in and detach on sign-out. `useExerciseStore` is the
  one to know about here: it opens **four** listeners (global exercises, overrides, custom
  exercises, user groups) and only reports `isLoading: false` once all four have fired at least
  once ([`features/exercises/store/use-exercise-store.ts`](../../features/exercises/store/use-exercise-store.ts)).
  Its four error callbacks only `console.error` — unlike the other three stores they do not clear
  `isLoading`, so a listener that fails (a rules rejection, say) leaves the Exercises tab redacted
  indefinitely.

Writes — this is one of only two write paths in the entire app (the other is the profile mutations
in [`use-user-store.ts`](../../features/user/store/use-user-store.ts)):

- **`users/{uid}`**, created once on first sign-in with `serverTimestamp()` for `createdAt` and
  `updatedAt`.
- **`users/{uid}/exerciseGroups/*`**, one document per global group, written in the same atomic
  batch as the profile. The `getDocs(globalGroupsRef())` that feeds it is _outside_ the batch, so an
  empty global collection produces a profile with no groups rather than an error.
- **Name fields on `users/{uid}`**, patched on a later Apple sign-in that returns a name.

Nothing persists locally beyond Firebase Auth's own native session storage — there is no
AsyncStorage/MMKV/SecureStore usage on this path.

## Alternative, empty, and error paths

- **User cancels the Apple sheet.** `ERR_REQUEST_CANCELED` is recognised explicitly and logged as
  `'User canceled Apple Sign-In'` rather than an error — but it is still rethrown, and the screen
  still shows nothing either way.
- **Apple Sign-In unavailable on the device.** `console.warn` and a silent return; the button stays
  where it is and appears to do nothing.
- **No identity token in the credential.** Throws `Apple Sign-In failed - no identity token
returned`, which lands in the same swallowed catch.
- **Auth still resolving.** `app/_layout.tsx` renders a bare centered view, and `app/index.tsx` and
  `app/(public)/login.tsx` each return `null`. `expo-splash-screen` is configured (500ms fade) in
  the root layout but never held open with `preventAutoHideAsync`, so on a slow auth resolution the
  splash hands over to a blank background rather than to a screen.
- **Profile document missing while signed in.** `profile: null`, `isLoading: false` — Settings falls
  back to `'User'` / `'No email'` and omits the "Member since" line, and the theme falls back to
  system. **This is visually identical to a Firestore permission or network failure**, which sets
  the same state after logging `[UserStore]`. Nothing distinguishes the two for the user; treat it
  as a gap rather than a decision.
- **Sign-out failure.** The store logs and rethrows; `SettingsContent` catches and logs
  `[Settings] logout`. The alert dismisses and the user stays signed in with no explanation.
  (`AuthScreen` has its own sign-out handler with an empty catch, but it sits in the unreachable
  `isLoggedIn` branch described above.)

## Completion state

After a successful first sign-in: a Firebase Auth user exists for the Apple ID; `users/{uid}` holds
the profile with default settings and zeroed stats; `users/{uid}/exerciseGroups` holds one
`isDefault: true` copy of each global group; all four stores are subscribed (seven `onSnapshot`
listeners in total, four of them from the exercise store); and the user is on the Home tab with
`isLoggedIn: true`. Every later launch reaches that same state at step 3 without
touching Apple's sheet or writing anything.

After sign-out: no Firebase user, all four stores back to their empty `isLoading: true` shape, the
`(private)` subtree removed from the navigator, and the login screen on screen. Nothing is deleted
server-side — signing back in with the same Apple ID resumes the same profile.
