import type React from 'react';
import { HStack, Section, Text, VStack } from '@expo/ui/swift-ui';
import {
  accessibilityAddTraits,
  accessibilityElement,
  accessibilityHidden,
  accessibilityLabel,
  font,
  foregroundStyle,
  frame,
  listRowBackground,
  listRowInsets,
  listRowSeparator,
  listSectionMargins,
} from '@expo/ui/swift-ui/modifiers';

import { Avatar } from '@/features/avatar/avatar';
import { useGreeting } from '@/features/home/use-greeting';
import { colors } from '@/theme/colors';

export interface HomeHeaderProps {
  /** Name shown beside the avatar and used for fallback initials. */
  displayName: string;
  /** Remote profile image URI. When absent, initials are shown. */
  photoURL?: string | null;
  /** Stable user identity used to choose the avatar fallback gradient. */
  avatarSeed: string;
  /** Whether the profile is still loading. */
  isLoading: boolean;
}

const HEADER_MODIFIERS = [
  listSectionMargins({ length: 0, edges: 'horizontal' }),
  listRowInsets({ top: 12, leading: 20, bottom: 8, trailing: 20 }),
  listRowBackground('transparent'),
  listRowSeparator('hidden'),
];

const TEXT_STACK_MODIFIERS = [
  frame({ maxWidth: Infinity, alignment: 'leading' }),
];

const GREETING_MODIFIERS = [
  font({ textStyle: 'subheadline' }),
  foregroundStyle(colors.secondaryLabel),
];

const NAME_MODIFIERS = [
  font({ textStyle: 'title', weight: 'bold' }),
  foregroundStyle(colors.label),
];

/** Profile greeting shown at the top of Home. Host-less for use in its List. */
export const HomeHeader: React.FC<HomeHeaderProps> = ({
  displayName,
  photoURL,
  avatarSeed,
  isLoading,
}) => {
  const greeting = useGreeting();
  const accessibilityModifiers = [
    accessibilityElement('combine'),
    accessibilityLabel(`${greeting}, ${displayName}`),
    accessibilityAddTraits(['isHeader']),
    accessibilityHidden(isLoading),
  ];

  return (
    <Section modifiers={HEADER_MODIFIERS}>
      <HStack
        spacing={14}
        alignment="center"
        modifiers={accessibilityModifiers}
      >
        <Avatar
          source={photoURL}
          fallback={displayName}
          seed={avatarSeed}
          size={56}
        />
        <VStack
          alignment="leading"
          spacing={0}
          modifiers={TEXT_STACK_MODIFIERS}
        >
          <Text modifiers={GREETING_MODIFIERS}>{greeting}</Text>
          <Text modifiers={NAME_MODIFIERS}>{displayName}</Text>
        </VStack>
      </HStack>
    </Section>
  );
};
