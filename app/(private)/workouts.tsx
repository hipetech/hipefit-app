import { View } from 'react-native';

import { Text } from '@/components/ui/text';

export default function Workouts() {
  return (
    <View className="flex-1 bg-background p-4">
      <View className="flex-1 items-center justify-center">
        <Text className="text-2xl font-bold">Workouts</Text>
        <Text variant="muted" className="mt-2">
          Your workouts will appear here
        </Text>
      </View>
    </View>
  );
}
