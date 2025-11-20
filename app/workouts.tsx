import { Image } from "@/components/ui/Image";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CardContent } from "@/components/ui/card";
import { Text } from "@/components/ui/text";
import {
  ScrollView,
  View,
} from "react-native";
import { categories, workoutData } from "@/mock/workouts";

export default function Workouts() {
  return (
    <ScrollView className="flex-1 bg-gray-100">
      <View className="p-5 pt-15">
      <View className="mb-6">
        <Text variant="h1" className="mb-2">Workouts</Text>
        <Text variant="muted">Choose your next challenge</Text>
      </View>

      {/* Category Filter */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        className="mb-6"
      >
        <View className="flex-row gap-3">
        {categories.map((category) => (
          <Button key={category} variant="outline" className="mr-2">
            <Text variant="small">{category}</Text>
          </Button>
        ))}
        </View>
      </ScrollView>

      {/* Workout List */}
      <View className="gap-4">
        {workoutData.map((workout) => (
          <Button
            key={workout.id}
            variant="ghost"
            className="flex-row bg-white rounded-2xl overflow-hidden shadow-sm p-0 h-auto"
          >
            <Image
              className="w-[120px] h-[120px]"
              source={{ uri: workout.image }}
              contentFit="cover"
              transition={200}
            />
            <CardContent className="flex-1 p-4 justify-between">
              <View className="flex-row justify-between items-start mb-2">
                <Text className="text-lg font-semibold flex-1 mr-2">{workout.title}</Text>
                <Badge>
                  <Text className="text-[10px] font-semibold uppercase">
                    {workout.category}
                  </Text>
                </Badge>
              </View>
              <View className="flex-row gap-4 items-center">
                <Text variant="muted">⏱ {workout.duration}</Text>
                <Text className="text-blue-500 font-semibold">
                  {workout.difficulty}
                </Text>
              </View>
            </CardContent>
          </Button>
        ))}
      </View>
      </View>
    </ScrollView>
  );
}
