import type React from 'react';
import { useCallback, useState } from 'react';
import { Host } from '@expo/ui';
import {
  Button,
  SecureField,
  Text,
  TextField,
  VStack,
} from '@expo/ui/swift-ui';
import {
  accessibilityIdentifier,
  autocorrectionDisabled,
  disabled,
  font,
  foregroundStyle,
  keyboardType,
  textFieldStyle,
  textInputAutocapitalization,
} from '@expo/ui/swift-ui/modifiers';

import { useAppColorScheme } from '@/hooks/use-app-color-scheme';
import { useAuthStore } from '@/stores/use-auth-store';
import { colors } from '@/theme/colors';
import { mods } from '@/theme/modifiers';

const SIGN_IN_ERROR_MESSAGE =
  'Sign-in failed. Check the credentials and the dev project.';

/**
 * Maestro's `inputText` types one character at a time, so anything that
 * rewrites typed text corrupts the address before it is submitted. Autocorrect
 * and autocapitalization are both off for that reason, and the email keyboard
 * keeps `@` and `.` on the first layer.
 *
 * No `textContentType` here or on the password field: `username` and `password`
 * make iOS offer to save the credentials after sign-in, and that system sheet
 * would cover Home in the middle of a flow.
 */
const EMAIL_FIELD_MODIFIERS = [
  textFieldStyle('roundedBorder'),
  autocorrectionDisabled(),
  textInputAutocapitalization('never'),
  keyboardType('email-address'),
  accessibilityIdentifier('test-account-email'),
];

const PASSWORD_FIELD_MODIFIERS = [
  textFieldStyle('roundedBorder'),
  accessibilityIdentifier('test-account-password'),
];

const SUBMIT_MODIFIERS = [
  ...mods.secondaryActionButton,
  accessibilityIdentifier('test-account-submit'),
];

const SUBMITTING_MODIFIERS = [...SUBMIT_MODIFIERS, disabled(true)];

const ERROR_TEXT_MODIFIERS = [
  font({ textStyle: 'footnote' }),
  foregroundStyle(colors.systemRed),
];

/**
 * Email and password sign-in for the end-to-end test account.
 *
 * `AuthScreen` renders this only in development builds, and the auth service
 * refuses the call in any other environment. The identifiers are the selectors
 * the Maestro flows under `e2e/` tap.
 *
 * The error is local state because the store never sets `isLoading` when the
 * credentials themselves are rejected, so nothing in the store marks a failed
 * attempt. The store has already logged the error by the time it rethrows.
 *
 * The `Host` measures its height only. A text field has no intrinsic width, so
 * the width comes from the React Native parent.
 */
export const TestAccountSignIn: React.FC = () => {
  const colorScheme = useAppColorScheme();
  const signInWithTestAccount = useAuthStore(
    (state) => state.signInWithTestAccount
  );
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [didFail, setDidFail] = useState(false);

  const submit = useCallback(async () => {
    setDidFail(false);
    setIsSubmitting(true);
    try {
      await signInWithTestAccount(email.trim(), password);
    } catch {
      setDidFail(true);
    } finally {
      setIsSubmitting(false);
    }
  }, [email, password, signInWithTestAccount]);

  return (
    <Host matchContents={{ vertical: true }} colorScheme={colorScheme}>
      <VStack spacing={12}>
        <TextField
          placeholder="Test account email"
          onTextChange={setEmail}
          modifiers={EMAIL_FIELD_MODIFIERS}
        />
        <SecureField
          placeholder="Password"
          onTextChange={setPassword}
          modifiers={PASSWORD_FIELD_MODIFIERS}
        />
        <Button
          label="Sign In with Test Account"
          onPress={submit}
          modifiers={isSubmitting ? SUBMITTING_MODIFIERS : SUBMIT_MODIFIERS}
        />
        {didFail ? (
          <Text modifiers={ERROR_TEXT_MODIFIERS}>{SIGN_IN_ERROR_MESSAGE}</Text>
        ) : null}
      </VStack>
    </Host>
  );
};
