import type { ComponentRef } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import { forwardRef } from 'react';
import { GlassView, isLiquidGlassAvailable } from 'expo-glass-effect';
import { Popover as HeroPopover } from 'heroui-native';

type HeroContentProps = React.ComponentProps<typeof HeroPopover.Content>;
type HeroContentRef = ComponentRef<typeof HeroPopover.Content>;

const glassEnabled = isLiquidGlassAvailable();

const PopoverContent = forwardRef<HeroContentRef, HeroContentProps>(
  (props, ref) => {
    if (!glassEnabled) {
      return <HeroPopover.Content ref={ref} {...props} />;
    }

    const { style, children, ...rest } = props;

    const glassStyle: StyleProp<ViewStyle> = [
      { overflow: 'hidden', backgroundColor: 'transparent' },
      style as StyleProp<ViewStyle>,
    ];

    return (
      <HeroPopover.Content
        ref={ref}
        {...rest}
        style={glassStyle as typeof style}
      >
        <GlassView
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
          }}
        />
        {children}
      </HeroPopover.Content>
    );
  }
);

PopoverContent.displayName = 'Popover.Content';

const Popover = Object.assign(
  Object.create(
    Object.getPrototypeOf(HeroPopover),
    Object.getOwnPropertyDescriptors(HeroPopover)
  ) as typeof HeroPopover,
  { Content: PopoverContent }
);

export { Popover };
