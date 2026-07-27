import type { Role, TextStyle } from 'react-native';
import * as React from 'react';
import { Platform, Text as RNText } from 'react-native';

import { colors } from '@/theme/colors';

const baseStyle: TextStyle = {
  color: colors.label,
  fontSize: 16,
};

const variantStyles = {
  default: {},
  h1: {
    fontSize: 36,
    lineHeight: 40,
    fontWeight: '800',
    letterSpacing: -0.5,
    textAlign: 'center',
  },
  h2: {
    fontSize: 30,
    lineHeight: 36,
    fontWeight: '600',
    letterSpacing: -0.4,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderColor: colors.separator,
  },
  h3: {
    fontSize: 24,
    lineHeight: 32,
    fontWeight: '600',
    letterSpacing: -0.3,
  },
  h4: {
    fontSize: 20,
    lineHeight: 28,
    fontWeight: '600',
    letterSpacing: -0.2,
  },
  p: {
    fontSize: 16,
    lineHeight: 28,
    marginTop: 12,
  },
  blockquote: {
    fontSize: 16,
    fontStyle: 'italic',
    marginTop: 16,
    paddingLeft: 12,
    borderLeftWidth: 2,
    borderColor: colors.separator,
  },
  code: {
    fontFamily: Platform.select({ ios: 'Menlo', default: 'monospace' }),
    fontSize: 14,
    fontWeight: '600',
    backgroundColor: colors.secondarySystemBackground,
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 3,
  },
  lead: {
    fontSize: 20,
    lineHeight: 28,
    color: colors.secondaryLabel,
  },
  large: {
    fontSize: 18,
    fontWeight: '600',
  },
  small: {
    fontSize: 14,
    lineHeight: 14,
    fontWeight: '500',
  },
  muted: {
    fontSize: 14,
    color: colors.secondaryLabel,
  },
} as const satisfies Record<string, TextStyle>;

type TextVariant = keyof typeof variantStyles;

const ROLE: Partial<Record<TextVariant, Role>> = {
  h1: 'heading',
  h2: 'heading',
  h3: 'heading',
  h4: 'heading',
  blockquote: Platform.select({ web: 'blockquote' as Role }),
  code: Platform.select({ web: 'code' as Role }),
};

const ARIA_LEVEL: Partial<Record<TextVariant, string>> = {
  h1: '1',
  h2: '2',
  h3: '3',
  h4: '4',
};

/**
 * App text primitive. Plain RN `Text` styled from `@/theme/colors` semantic
 * tokens with typography `variant`s (previously Tailwind classes). Usable
 * anywhere in the RN tree; inside an `@expo/ui` swift-ui `Host` use swift-ui
 * `Text` instead.
 */
function Text({
  style,
  variant = 'default',
  ...props
}: React.ComponentProps<typeof RNText> &
  React.RefAttributes<RNText> & {
    variant?: TextVariant;
  }) {
  return (
    <RNText
      style={[baseStyle, variantStyles[variant], style]}
      role={variant ? ROLE[variant] : undefined}
      aria-level={variant ? ARIA_LEVEL[variant] : undefined}
      {...props}
    />
  );
}

export { Text };
