import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import type { LucideIcon } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Button, Popover, useThemeColor } from 'heroui-native';
import { Dumbbell, Home, ListChecks, User } from 'lucide-react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { scheduleOnRN } from 'react-native-worklets';

export const TAB_BAR_HEIGHT = 60;
export const TAB_BAR_TOTAL_HEIGHT = TAB_BAR_HEIGHT + 32;

const TAB_ICONS: Record<string, LucideIcon> = {
  index: Home,
  workouts: Dumbbell,
  exercises: ListChecks,
  settings: User,
};

const SPRING_CONFIG = { damping: 20, stiffness: 200, mass: 0.8 };
const INDICATOR_SIZE = 42;
const FAB_SIZE = 52;
const DRAG_ACTIVATION_OFFSET = 10;

export interface CreateMenuItem {
  label: string;
  icon: LucideIcon;
  onPress: () => void;
}

export interface ActionButtonConfig {
  icon: LucideIcon;
  items: CreateMenuItem[];
}

interface TabBarProps extends BottomTabBarProps {
  actionButton?: ActionButtonConfig;
}

export function TabBar({
  state,
  descriptors,
  navigation,
  actionButton,
}: TabBarProps) {
  const insets = useSafeAreaInsets();
  const [accentColor, accentFg, mutedColor, defaultColor] = useThemeColor([
    'accent',
    'accent-foreground',
    'muted',
    'default',
  ]);

  const [isPopoverOpen, setIsPopoverOpen] = useState(false);

  // Shared value so worklets (pan gesture) can read the width on the UI thread
  const pillWidth = useSharedValue(0);
  const indicatorX = useSharedValue(0);
  const indicatorReady = useSharedValue(0);

  // Drag state
  const gestureStartX = useSharedValue(0);
  const lastSnappedIdx = useSharedValue(-1);

  // Only include routes that have a tab icon (filters out functional-button, etc.)
  const visibleRoutes = state.routes.reduce<
    { route: (typeof state.routes)[number]; stateIndex: number }[]
  >((acc, route, i) => {
    if (route.name in TAB_ICONS) {
      acc.push({ route, stateIndex: i });
    }
    return acc;
  }, []);

  const tabCount = visibleRoutes.length;

  // Which position (0-based) in visibleRoutes is active?
  const activeIdx = visibleRoutes.findIndex(
    (r) => r.stateIndex === state.index
  );

  // ---- Indicator position helpers (inlined for worklet compatibility) ----
  // padding = (slotW - INDICATOR_SIZE) / 2  →  indicator centered in slot
  // x(idx) = idx * slotW + padding

  // Slide indicator when active tab changes (tap navigation)
  useEffect(() => {
    if (pillWidth.value === 0 || activeIdx === -1) return;
    const slotW = pillWidth.value / tabCount;
    indicatorX.value = withSpring(
      activeIdx * slotW + (slotW - INDICATOR_SIZE) / 2,
      SPRING_CONFIG
    );
  }, [activeIdx, indicatorX, tabCount, pillWidth]);

  const indicatorStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: indicatorX.value }],
    opacity: indicatorReady.value,
  }));

  const handlePillLayout = (e: {
    nativeEvent: { layout: { width: number } };
  }) => {
    const w = e.nativeEvent.layout.width;
    pillWidth.value = w;
    if (activeIdx === -1) return;
    const slotW = w / tabCount;
    indicatorX.value = activeIdx * slotW + (slotW - INDICATOR_SIZE) / 2;
    indicatorReady.value = 1;
  };

  // ---- Drag-to-select gesture ----

  const triggerSelectionHaptic = () => {
    Haptics.selectionAsync();
  };

  const navigateToTab = (idx: number) => {
    const target = visibleRoutes[idx];
    if (!target || target.stateIndex === state.index) return;
    navigation.navigate(target.route.name, target.route.params);
  };

  const panGesture = Gesture.Pan()
    .activeOffsetX([-DRAG_ACTIVATION_OFFSET, DRAG_ACTIVATION_OFFSET])
    .onStart(() => {
      'worklet';
      gestureStartX.value = indicatorX.value;
      lastSnappedIdx.value = -1;
    })
    .onUpdate((e) => {
      'worklet';
      const w = pillWidth.value;
      if (w === 0) return;
      const slotW = w / tabCount;
      const padding = (slotW - INDICATOR_SIZE) / 2;
      const minX = padding;
      const maxX = (tabCount - 1) * slotW + padding;

      indicatorX.value = Math.min(
        maxX,
        Math.max(minX, gestureStartX.value + e.translationX)
      );

      // Haptic tick when crossing into a new tab zone
      const nearest = Math.round((indicatorX.value - padding) / slotW);
      const clamped = Math.min(Math.max(0, nearest), tabCount - 1);
      if (clamped !== lastSnappedIdx.value) {
        lastSnappedIdx.value = clamped;
        scheduleOnRN(triggerSelectionHaptic);
      }
    })
    .onEnd(() => {
      'worklet';
      const w = pillWidth.value;
      if (w === 0) return;
      const slotW = w / tabCount;
      const padding = (slotW - INDICATOR_SIZE) / 2;

      // Snap to nearest tab
      const nearest = Math.round((indicatorX.value - padding) / slotW);
      const targetIdx = Math.min(Math.max(0, nearest), tabCount - 1);
      indicatorX.value = withSpring(targetIdx * slotW + padding, SPRING_CONFIG);

      scheduleOnRN(navigateToTab, targetIdx);
    });

  return (
    <View
      style={{ paddingBottom: Math.max(insets.bottom - 8, 8) }}
      className="absolute right-0 bottom-0 left-0 flex-row items-center justify-center gap-3 px-5"
    >
      {/* ---- Tab pill with drag gesture ---- */}
      <GestureDetector gesture={panGesture}>
        <Animated.View
          className="flex-1 flex-row items-center rounded-full shadow-lg"
          style={{ backgroundColor: defaultColor, height: TAB_BAR_HEIGHT }}
          onLayout={handlePillLayout}
        >
          {/* Sliding indicator */}
          <Animated.View
            style={[
              indicatorStyle,
              {
                position: 'absolute',
                width: INDICATOR_SIZE,
                height: INDICATOR_SIZE,
                borderRadius: INDICATOR_SIZE / 2,
                backgroundColor: accentColor,
              },
            ]}
          />

          {visibleRoutes.map(({ route, stateIndex }) => (
            <TabBarItem
              key={route.key}
              routeName={route.name}
              routeKey={route.key}
              routeParams={route.params}
              isFocused={state.index === stateIndex}
              title={descriptors[route.key]?.options.title ?? route.name}
              navigation={navigation}
              activeColor={accentFg}
              inactiveColor={mutedColor}
            />
          ))}
        </Animated.View>
      </GestureDetector>

      {/* ---- Floating action button with popover ---- */}
      {actionButton ? (
        <Popover
          isOpen={isPopoverOpen}
          onOpenChange={(open) => {
            setIsPopoverOpen(open);
            if (open) {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            }
          }}
        >
          <Popover.Trigger asChild>
            <Pressable
              className="items-center justify-center rounded-full shadow-lg"
              style={{
                backgroundColor: accentColor,
                width: FAB_SIZE,
                height: FAB_SIZE,
              }}
              accessibilityRole="button"
              accessibilityLabel="Create"
            >
              <actionButton.icon size={24} color={accentFg} strokeWidth={2.5} />
            </Pressable>
          </Popover.Trigger>
          <Popover.Portal>
            <Popover.Overlay />
            <Popover.Content
              presentation="popover"
              placement="top"
              align="end"
              className="border-border rounded-2xl border p-2"
            >
              {actionButton.items.map((item) => (
                <Button
                  key={item.label}
                  variant="ghost"
                  size="lg"
                  className="justify-start"
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setIsPopoverOpen(false);
                    item.onPress();
                  }}
                >
                  <item.icon size={20} color={mutedColor} strokeWidth={2} />
                  <Button.Label>{item.label}</Button.Label>
                </Button>
              ))}
            </Popover.Content>
          </Popover.Portal>
        </Popover>
      ) : null}
    </View>
  );
}

/* ------------------------------------------------------------------ */

interface TabBarItemProps {
  routeName: string;
  routeKey: string;
  routeParams: object | undefined;
  isFocused: boolean;
  title: string;
  navigation: BottomTabBarProps['navigation'];
  activeColor: string;
  inactiveColor: string;
}

function TabBarItem({
  routeName,
  routeKey,
  routeParams,
  isFocused,
  title,
  navigation,
  activeColor,
  inactiveColor,
}: TabBarItemProps) {
  const IconComponent = TAB_ICONS[routeName];
  const scale = useSharedValue(isFocused ? 1.15 : 1);
  const opacity = useSharedValue(isFocused ? 1 : 0.5);

  useEffect(() => {
    scale.value = withSpring(isFocused ? 1.15 : 1, SPRING_CONFIG);
    opacity.value = withSpring(isFocused ? 1 : 0.5, SPRING_CONFIG);
  }, [isFocused, scale, opacity]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  const handlePress = () => {
    const event = navigation.emit({
      type: 'tabPress',
      target: routeKey,
      canPreventDefault: true,
    });

    if (!isFocused && !event.defaultPrevented) {
      navigation.navigate(routeName, routeParams);
    }

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const handleLongPress = () => {
    navigation.emit({ type: 'tabLongPress', target: routeKey });
  };

  return (
    <Pressable
      className="flex-1 items-center justify-center"
      style={{ height: TAB_BAR_HEIGHT }}
      onPress={handlePress}
      onLongPress={handleLongPress}
      accessibilityRole="tab"
      accessibilityState={{ selected: isFocused }}
      accessibilityLabel={title}
    >
      <Animated.View style={animatedStyle}>
        {IconComponent ? (
          <IconComponent
            size={22}
            color={isFocused ? activeColor : inactiveColor}
            strokeWidth={isFocused ? 2.5 : 2}
          />
        ) : null}
      </Animated.View>
    </Pressable>
  );
}
