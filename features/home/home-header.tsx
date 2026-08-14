import type React from 'react';
import { HStack, Section, Text, VStack } from '@expo/ui/swift-ui';
import {
  accessibilityAddTraits,
  accessibilityElement,
  accessibilityHidden,
  accessibilityLabel,
  fixedSize,
  font,
  foregroundStyle,
  frame,
  listRowBackground,
  listRowInsets,
  listRowSeparator,
  listSectionMargins,
} from '@expo/ui/swift-ui/modifiers';

import { Avatar } from '@/features/avatar/avatar';
import { useHomeClock } from '@/features/home/use-clock';
import { formatDayOfMonth, formatMonthName } from '@/lib/format';
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

/**
 * The name column already claims every spare point with `maxWidth: Infinity`,
 * so without this the date is the side that gets compressed and truncated.
 * Horizontal only — the two lines must still be free to grow vertically under
 * Dynamic Type.
 */
const DATE_STACK_MODIFIERS = [fixedSize({ horizontal: true })];

const GREETING_MODIFIERS = [
  font({ textStyle: 'subheadline' }),
  foregroundStyle(colors.secondaryLabel),
];

const NAME_MODIFIERS = [
  font({ textStyle: 'title', weight: 'bold' }),
  foregroundStyle(colors.label),
];

/**
 * Profile greeting shown at the top of Home. Host-less for use in its List.
 *
 * The trailing date deliberately mirrors the greeting/name column's two tiers —
 * month on the subheadline, day on the bold title — so the row reads as one
 * balanced header rather than a label with something bolted to the end.
 *
 * It shows **today**, and does not follow the calendar below. The calendar
 * keeps its own month caption, which is the thing that tracks paging; this is a
 * fixed "you are here" reference, and the two only agree while the calendar is
 * on the current month.
 */
export const HomeHeader: React.FC<HomeHeaderProps> = ({
  displayName,
  photoURL,
  avatarSeed,
  isLoading,
}) => {
  const { greeting, todayDateId } = useHomeClock();
  const monthName = formatMonthName(todayDateId);
  const dayOfMonth = formatDayOfMonth(todayDateId);
  const accessibilityModifiers = [
    accessibilityElement('combine'),
    // Combining discards the children's own labels, so the date has to be
    // spelled out here or VoiceOver never reads it at all.
    accessibilityLabel(
      `${greeting}, ${displayName}. ${monthName} ${dayOfMonth}`
    ),
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
        <VStack
          alignment="trailing"
          spacing={0}
          modifiers={DATE_STACK_MODIFIERS}
        >
          <Text modifiers={GREETING_MODIFIERS}>{monthName}</Text>
          <Text modifiers={NAME_MODIFIERS}>{dayOfMonth}</Text>
        </VStack>
      </HStack>
    </Section>
  );
};
