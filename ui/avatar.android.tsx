import type { AvatarProps } from './avatar';
import { Text, View } from 'react-native';
import { Image as ExpoImage } from 'expo-image';

import { getInitials } from '@/lib/format';
import { colors } from '@/theme/colors';

/** Circular avatar (Android fallback): `expo-image` or brand-tinted initials. */
export const Avatar = ({ source, fallback, size = 40 }: AvatarProps) => {
  if (source) {
    return (
      <ExpoImage
        source={source}
        style={{ width: size, height: size, borderRadius: size / 2 }}
      />
    );
  }

  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: colors.brand,
      }}
    >
      <Text
        style={{
          fontSize: size * 0.4,
          fontWeight: '600',
          color: colors.brandForeground,
        }}
      >
        {getInitials(fallback)}
      </Text>
    </View>
  );
};
