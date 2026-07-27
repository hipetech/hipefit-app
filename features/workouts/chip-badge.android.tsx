import type { ChipBadgeProps } from './chip-badge';

import { Chip } from '@/ui/chip';

/** Standalone chip badge (Android fallback): the RN `Chip` primitive. */
export const ChipBadge = ({ label, variant = 'secondary' }: ChipBadgeProps) => (
  <Chip label={label} variant={variant} />
);
