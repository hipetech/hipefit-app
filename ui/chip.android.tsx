import type { ChipProps } from './chip';
import { Text, View } from 'react-native';

import { colors } from '@/theme/colors';

/** Small capsule label (Android fallback): plain RN `View` + `Text`. */
export const Chip = ({ label, variant = 'secondary' }: ChipProps) => {
  const isPrimary = variant === 'primary';

  return (
    <View
      style={{
        alignSelf: 'flex-start',
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 9999,
        backgroundColor: isPrimary
          ? colors.brand
          : colors.tertiarySystemBackground,
      }}
    >
      <Text
        style={{
          fontSize: 12,
          fontWeight: '600',
          color: isPrimary ? colors.brandForeground : colors.label,
        }}
      >
        {label}
      </Text>
    </View>
  );
};
