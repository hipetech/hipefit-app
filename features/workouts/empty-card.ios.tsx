import type { EmptyCardProps } from './empty-card';
import { Button, Host } from '@expo/ui';
import { Text } from '@expo/ui/swift-ui';
import {
  font,
  foregroundColor,
  multilineTextAlignment,
} from '@expo/ui/swift-ui/modifiers';

import { BRAND_SEED, colors } from '@/theme/colors';
import { Card } from '@/ui/card';

/** Empty-state card (iOS): a SwiftUI `Host` island. */
export const EmptyCard = ({
  message,
  width,
  actionLabel,
  onAction,
  colorScheme,
}: EmptyCardProps) => (
  <Host
    style={{ width }}
    matchContents={{ vertical: true }}
    seedColor={BRAND_SEED}
    colorScheme={colorScheme}
  >
    <Card padding={20} alignment="center">
      <Text
        modifiers={[
          font({ size: 14 }),
          foregroundColor(colors.secondaryLabel),
          multilineTextAlignment('center'),
        ]}
      >
        {message}
      </Text>
      {actionLabel ? (
        <Button label={actionLabel} variant="outlined" onPress={onAction} />
      ) : null}
    </Card>
  </Host>
);
