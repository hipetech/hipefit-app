import type { ChipBadgeProps } from './chip-badge';
import { Host } from '@expo/ui';

import { BRAND_SEED } from '@/theme/colors';
import { Chip } from '@/ui/chip';

/** Standalone chip badge (iOS): the `Chip` primitive in its own `Host`. */
export const ChipBadge = ({
  label,
  variant = 'secondary',
  colorScheme,
}: ChipBadgeProps) => (
  <Host matchContents seedColor={BRAND_SEED} colorScheme={colorScheme}>
    <Chip label={label} variant={variant} />
  </Host>
);
