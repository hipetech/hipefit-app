/* eslint-disable jsx-a11y/aria-role -- `role` on a SwiftUI `Button` is
   `'default' | 'cancel' | 'destructive'` (see @expo/ui Button.d.ts), not a
   DOM ARIA role; the a11y rule cannot tell the two apart. */
import type { UserSettings } from '@/database';
import { useCallback, useState } from 'react';
import { Host } from '@expo/ui';
import {
  Alert,
  Button,
  HStack,
  Image,
  List,
  Picker,
  Section,
  Spacer,
  Text,
  VStack,
} from '@expo/ui/swift-ui';
import {
  accessibilityHidden,
  accessibilityHint,
  font,
  foregroundStyle,
  lineLimit,
  padding,
  pickerStyle,
  tag,
  truncationMode,
} from '@expo/ui/swift-ui/modifiers';
import { useRouter } from 'expo-router';

import { useAuthStore } from '@/features/auth/store/use-auth-store';
import { Avatar } from '@/features/avatar/avatar';
import { useUserStore } from '@/features/user/store/use-user-store';
import { useAppColorScheme } from '@/hooks/use-app-color-scheme';
import { colors } from '@/theme/colors';
import { mods } from '@/theme/modifiers';
import { layout } from '@/theme/styles';

/** Placeholder text shown behind `redacted('placeholder')` while the profile loads. */
const PLACEHOLDER_NAME = 'Placeholder Name';
const PLACEHOLDER_EMAIL = 'placeholder@example.com';

/**
 * Apple private-relay addresses are long and unbreakable; a tail/word wrap
 * hyphenates mid-token ("appleid.-com") and reads as a rendering bug. One line
 * + middle truncation keeps the mailbox and the domain, and degrades honestly.
 */
const PROFILE_EMAIL_MODIFIERS = [
  font({ textStyle: 'footnote' }),
  foregroundStyle(colors.secondaryLabel),
  lineLimit(1),
  truncationMode('middle'),
];

/**
 * Hand-drawn disclosure indicator, deliberately.
 * @expo/ui exposes no `NavigationLink`, and the SwiftUI `Link`
 * it does export takes a URL `destination` handed to `openURL` —
 * it neither pushes an Expo Router route nor draws a chevron. An
 * expo-router `<Link>` is a React Native view and cannot nest
 * inside this SwiftUI `List`. So the glyph stays hand-drawn, but:
 * it now scales with Dynamic Type (`font` with a `textStyle`,
 * which also supersedes the old fixed `size={14}`), and it is
 * hidden from VoiceOver so the row announces once, as a button
 * with a hint, instead of trailing a stray image.
 * `foregroundStyle({ hierarchical: 'tertiary' })` was tried and
 * rejected: hierarchical styles resolve against the *inherited*
 * foreground, which inside a `Button` is the accent tint, so the
 * chevron would render blue. `tertiaryLabel` is the gray UIKit
 * itself uses for the disclosure indicator.
 */
const DISCLOSURE_CHEVRON_MODIFIERS = [
  font({ textStyle: 'footnote', weight: 'semibold' }),
  foregroundStyle(colors.tertiaryLabel),
  accessibilityHidden(true),
];

/**
 * Body of the Settings screen.
 *
 * The component reads the user store itself and takes no props, so the route
 * file stays thin (title + this island).
 *
 * One `Host` filling the screen (`flex: 1`, deliberately **no** `matchContents`)
 * around one SwiftUI `List` with `listStyle('insetGrouped')`. A `List` has no
 * intrinsic content height, so it can only live at the root of a Host that owns
 * real space — nesting it in an RN `ScrollView`, or measuring it with
 * `matchContents`, renders nothing. `insetGrouped` supplies the 16pt margins,
 * 44pt row heights, inset hairlines and grouped background for free.
 */
export const SettingsContent = () => {
  const router = useRouter();
  const colorScheme = useAppColorScheme();
  const { user, signOut } = useAuthStore();
  const { profile, isLoading, updateSettings } = useUserStore();

  const [isLogoutAlertPresented, setLogoutAlertPresented] = useState(false);

  const displayName = isLoading
    ? PLACEHOLDER_NAME
    : (profile?.displayName ?? 'User');
  const email = isLoading ? PLACEHOLDER_EMAIL : (profile?.email ?? 'No email');
  const photoURL = isLoading ? null : profile?.photoURL;
  const theme: UserSettings['theme'] = profile?.settings?.theme ?? 'system';
  const memberSince = profile?.createdAt
    ? `Member since ${profile.createdAt.toDate().getFullYear()}`
    : null;

  const handleThemeChange = useCallback(
    (value: UserSettings['theme']) => {
      updateSettings({ theme: value });
    },
    [updateSettings]
  );

  const handleLogout = useCallback(async () => {
    try {
      await signOut();
    } catch (error) {
      console.error('[Settings] logout', error);
    }
  }, [signOut]);

  const openEditProfile = useCallback(() => {
    router.push('/settings/edit-profile');
  }, [router]);

  return (
    <Host style={layout.groupedScreen} colorScheme={colorScheme}>
      <List
        modifiers={
          isLoading ? mods.listInsetGroupedRedacted : mods.listInsetGrouped
        }
      >
        {/* Profile — the Settings.app Apple-ID row: tap to push the edit sheet. */}
        <Section>
          <Button
            onPress={openEditProfile}
            modifiers={[accessibilityHint('Opens the Edit Profile form.')]}
          >
            <HStack spacing={12} modifiers={[padding({ vertical: 6 })]}>
              <Avatar
                source={photoURL}
                fallback={displayName}
                seed={user?.uid ?? displayName}
                size={60}
              />
              <VStack alignment="leading" spacing={2}>
                <Text modifiers={mods.headlineLabelOneLine}>{displayName}</Text>
                <Text modifiers={PROFILE_EMAIL_MODIFIERS}>{email}</Text>
                {memberSince ? (
                  <Text modifiers={mods.footnoteSecondaryOneLine}>
                    {memberSince}
                  </Text>
                ) : null}
              </VStack>
              <Spacer />
              <Image
                systemName="chevron.right"
                modifiers={DISCLOSURE_CHEVRON_MODIFIERS}
              />
            </HStack>
          </Button>
        </Section>

        <Section title="App">
          {/* A menu Picker in a List row is the native label + value + chevron row. */}
          <Picker
            label="Theme"
            systemImage="paintpalette"
            selection={theme}
            onSelectionChange={handleThemeChange}
            modifiers={[pickerStyle('menu')]}
          >
            <Text modifiers={[tag('system')]}>System</Text>
            <Text modifiers={[tag('light')]}>Light</Text>
            <Text modifiers={[tag('dark')]}>Dark</Text>
          </Picker>
        </Section>

        {/* No "Your Stats" section here by design: Home owns activity stats
            (total workouts / current + longest streak) and renders the same
            three values in the same LabeledContent rows. Duplicating them in a
            second tab was already drifting, and Home is one tab-bar tap away —
            so there is deliberately no link back either. */}

        {/* A destructive confirm is an alert on iOS, never a sheet. */}
        <Section>
          <Alert
            title="Log Out?"
            isPresented={isLogoutAlertPresented}
            onIsPresentedChange={setLogoutAlertPresented}
          >
            <Alert.Trigger>
              <Button
                role="destructive"
                onPress={() => setLogoutAlertPresented(true)}
              >
                <HStack>
                  <Spacer />
                  <Text modifiers={mods.bodyDestructive}>Log Out</Text>
                  <Spacer />
                </HStack>
              </Button>
            </Alert.Trigger>
            <Alert.Message>
              <Text>
                You will be signed out of your account. You can sign back in
                anytime.
              </Text>
            </Alert.Message>
            <Alert.Actions>
              <Button role="cancel" label="Cancel" />
              <Button
                role="destructive"
                label="Log Out"
                onPress={handleLogout}
              />
            </Alert.Actions>
          </Alert>
        </Section>
      </List>
    </Host>
  );
};
