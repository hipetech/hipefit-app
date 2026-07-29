import { useCallback, useEffect, useRef, useState } from 'react';
import { Host } from '@expo/ui';
import {
  Button,
  HStack,
  List,
  Section,
  Spacer,
  Text,
  TextField,
  useNativeState,
} from '@expo/ui/swift-ui';
import {
  autocorrectionDisabled,
  disabled,
  font,
  foregroundStyle,
  textInputAutocapitalization,
} from '@expo/ui/swift-ui/modifiers';
import { useRouter } from 'expo-router';

import { useUserStore } from '@/features/user/store/use-user-store';
import { useAppColorScheme } from '@/hooks/use-app-color-scheme';
import { hapticSuccess } from '@/lib/haptics';
import { colors } from '@/theme/colors';
import { mods } from '@/theme/modifiers';
import { layout } from '@/theme/styles';

const EMPTY_NAME_MESSAGE = 'Enter a name to save.';
const HELP_MESSAGE = 'This is the name shown across the app.';
const SAVE_ERROR_MESSAGE = "Couldn't save your name. Check your connection.";

const NAME_FIELD_MODIFIERS = [
  autocorrectionDisabled(true),
  textInputAutocapitalization('words'),
];

/**
 * Body of the Edit Profile form-sheet route.
 *
 * Reads and writes the user store itself and takes no props. A single `Host`
 * fills the sheet with a SwiftUI `List` + `TextField`.
 *
 * The name field is backed by `useNativeState`: SwiftUI's `TextField` binds to
 * an `ObservableState`, never a plain string. That retires the old remount-`key`
 * hack — the native field owns the text once it is seeded.
 *
 * `useNativeState` captures its argument **once, on the first render**, so the
 * store value alone is not enough: if this sheet mounts before the Firestore
 * profile snapshot lands (cold-start deep link, Fast Refresh, slow first
 * snapshot after sign-in) the field would seed to `''` and never recover. The
 * effect below seeds the observable the first time a name becomes available,
 * and the `isSeeded` ref makes it strictly one-shot — a later snapshot, or one
 * that lands after the first keystroke, can never clobber what the user is
 * typing. When the profile is already present at mount — the warm path verified
 * on device — the ref starts `true` and the effect is a no-op, so that path is
 * byte-for-byte the behaviour that was signed off.
 *
 * Validation reads `draft`, a React mirror that is `null` until the user types:
 * an `ObservableState` lives on the UI thread and never re-renders React, so
 * the Save button could not otherwise know whether the field is empty. While
 * `draft` is `null` the store value stands in, which is exactly what the native
 * field is showing.
 */
export const EditProfileForm = () => {
  const router = useRouter();
  const colorScheme = useAppColorScheme();
  const profile = useUserStore((state) => state.profile);
  const updateProfile = useUserStore((state) => state.updateProfile);

  const storedName = profile?.displayName ?? '';

  const name = useNativeState(storedName);
  const [draft, setDraft] = useState<string | null>(null);
  const [didFail, setDidFail] = useState(false);
  const isSeeded = useRef(storedName.length > 0);

  useEffect(() => {
    if (isSeeded.current || storedName.length === 0) {
      return;
    }
    // Writing the observable is a write to an external (UI-thread) system, not
    // React state — that is what an effect is for.
    isSeeded.current = true;
    name.set(storedName);
  }, [name, storedName]);

  const handleTextChange = useCallback((text: string) => {
    // The user owns the field from the first keystroke; never re-seed under it.
    isSeeded.current = true;
    setDraft(text);
    setDidFail(false);
  }, []);

  const isEmpty = (draft ?? storedName).trim().length === 0;

  const save = useCallback(async () => {
    const next = name.get().trim();
    // Belt-and-braces: the Save button is `disabled` while the field is empty,
    // so this can only be reached if the mirror and the native field disagree.
    // Bailing out silently *and* dismissing is what made an empty name look
    // like a successful save, so never call `router.back()` without a write.
    if (next.length === 0) {
      setDraft(next);
      return;
    }
    try {
      await updateProfile({ displayName: next });
      // The sheet dismisses on save, so the confirmation is the *absence* of
      // the form. The success tick is the only thing that says the write
      // landed — and it fires only here, never on the catch below.
      hapticSuccess();
      router.back();
    } catch (error) {
      console.error('[EditProfile] save', error);
      setDidFail(true);
    }
  }, [name, router, updateProfile]);

  const footerMessage = didFail
    ? SAVE_ERROR_MESSAGE
    : isEmpty
      ? EMPTY_NAME_MESSAGE
      : HELP_MESSAGE;

  return (
    <Host style={layout.groupedScreen} colorScheme={colorScheme}>
      <List modifiers={mods.listInsetGrouped}>
        <Section
          title="Name"
          footer={
            <Text
              modifiers={[
                font({ textStyle: 'footnote' }),
                foregroundStyle(
                  didFail ? colors.systemRed : colors.secondaryLabel
                ),
              ]}
            >
              {footerMessage}
            </Text>
          }
        >
          <TextField
            text={name}
            placeholder="Your name"
            autoFocus
            onTextChange={handleTextChange}
            modifiers={NAME_FIELD_MODIFIERS}
          />
        </Section>

        <Section>
          <Button onPress={save} modifiers={[disabled(isEmpty)]}>
            <HStack>
              <Spacer />
              <Text
                modifiers={[font({ textStyle: 'body', weight: 'semibold' })]}
              >
                Save
              </Text>
              <Spacer />
            </HStack>
          </Button>
        </Section>
      </List>
    </Host>
  );
};
