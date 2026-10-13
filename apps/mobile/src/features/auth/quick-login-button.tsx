import type React from 'react';
import { Button, Host } from '@expo/ui';

import { useAppColorScheme } from '@/hooks/use-app-color-scheme';

export interface QuickLoginButtonProps {
  /** Called when the button is pressed. */
  onPress: () => void;
}

/**
 * Signs in with a throwaway account from the login screen. Owns its `Host`:
 * the Sign in with Apple button above it is a React Native view, so the two
 * are siblings in the React Native tree.
 *
 * `outlined` maps to SwiftUI's `bordered` button style at `@expo/ui` 57.0.7,
 * which keeps this button secondary to the Apple button.
 */
export const QuickLoginButton: React.FC<QuickLoginButtonProps> = ({
  onPress,
}) => {
  const colorScheme = useAppColorScheme();

  return (
    <Host matchContents colorScheme={colorScheme}>
      <Button variant="outlined" label="Quick Login" onPress={onPress} />
    </Host>
  );
};
