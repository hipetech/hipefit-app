import type { CreateMenuItem } from '@/ui/tab-bar';
import { useMemo } from 'react';
import { Tabs } from 'expo-router';
import { Dumbbell, ListPlus, Plus, Zap } from 'lucide-react-native';

import { TabBar } from '@/ui/tab-bar';

export default function TabsLayout() {
  const createMenuItems: CreateMenuItem[] = useMemo(
    () => [
      {
        label: 'Start instant workout',
        icon: Zap,
        onPress: () => {
          // TODO: navigate to instant workout
        },
      },
      {
        label: 'Create routine',
        icon: ListPlus,
        onPress: () => {
          // TODO: navigate to create routine
        },
      },
      {
        label: 'Create exercise',
        icon: Dumbbell,
        onPress: () => {
          // TODO: navigate to create exercise
        },
      },
    ],
    []
  );

  return (
    <Tabs
      tabBar={(props) => (
        <TabBar
          {...props}
          actionButton={{ icon: Plus, items: createMenuItems }}
        />
      )}
      screenOptions={{
        headerShown: false,
        sceneStyle: { backgroundColor: 'transparent' },
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Home' }} />
      <Tabs.Screen name="workouts" options={{ title: 'Workouts' }} />
      <Tabs.Screen name="exercises" options={{ title: 'Exercises' }} />
      <Tabs.Screen name="settings" options={{ title: 'Settings' }} />
    </Tabs>
  );
}
