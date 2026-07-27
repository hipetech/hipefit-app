import type { EmptyCardProps } from './empty-card';
import { Text } from 'react-native';

import { colors } from '@/theme/colors';
import { Card } from '@/ui/card';

import { FallbackButton } from './fallback-button';

/** Empty-state card (Android fallback): plain RN card. */
export const EmptyCard = ({
  message,
  width,
  actionLabel,
  onAction,
}: EmptyCardProps) => (
  <Card width={width} padding={20} alignment="center">
    <Text
      style={{
        fontSize: 14,
        color: colors.secondaryLabel,
        textAlign: 'center',
      }}
    >
      {message}
    </Text>
    {actionLabel ? (
      <FallbackButton
        label={actionLabel}
        variant="outlined"
        onPress={onAction}
      />
    ) : null}
  </Card>
);
