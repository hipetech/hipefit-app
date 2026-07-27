import { Pressable, Text } from 'react-native';

import { colors } from '@/theme/colors';

interface FallbackButtonProps {
  label: string;
  variant?: 'filled' | 'outlined';
  onPress?: () => void;
}

/**
 * Android fallback button (RN). Used by the `.android.tsx` island components in
 * place of the `@expo/ui` universal `Button`, which requires a Compose `Host`.
 */
export const FallbackButton = ({
  label,
  variant = 'filled',
  onPress,
}: FallbackButtonProps) => {
  const isFilled = variant === 'filled';

  return (
    <Pressable
      onPress={onPress}
      style={{
        alignSelf: 'flex-start',
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 10,
        backgroundColor: isFilled ? colors.brand : 'transparent',
        borderWidth: isFilled ? 0 : 1,
        borderColor: colors.brand,
      }}
    >
      <Text
        style={{
          fontSize: 15,
          fontWeight: '600',
          color: isFilled ? colors.brandForeground : colors.brand,
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
};
