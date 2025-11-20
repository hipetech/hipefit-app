import { Image } from "@/components/ui/Image";
import { Button } from "@/components/ui/button";
import { CardContent } from "@/components/ui/card";
import { Text } from "@/components/ui/text";
import {
  ScrollView,
  View,
} from "react-native";
import { exerciseData, muscleGroups } from "@/mock/exercises";

export default function Exercises() {
  return (
    <ScrollView className="flex-1 bg-gray-100">
      <View className="p-5 pt-15">
      <View className="mb-6">
        <Text variant="h1" className="mb-2">Exercises</Text>
        <Text variant="muted">Build your exercise library</Text>
      </View>

      {/* Muscle Group Filter */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        className="mb-6"
      >
        <View className="flex-row gap-3">
        {muscleGroups.map((group) => (
          <Button key={group} variant="outline" className="mr-2">
            <Text variant="small">{group}</Text>
          </Button>
        ))}
        </View>
      </ScrollView>

      {/* Exercise List */}
      <View className="gap-4">
        {exerciseData.map((exercise) => (
          <Button
            key={exercise.id}
            variant="ghost"
            className="flex-row bg-white rounded-2xl overflow-hidden shadow-sm p-0 h-auto"
          >
            <Image
              className="w-[120px] h-[140px]"
              source={{ uri: exercise.image }}
              contentFit="cover"
              transition={200}
            />
            <CardContent className="flex-1 p-4">
              <Text variant="h4" className="mb-3">{exercise.name}</Text>
              <View className="gap-2">
                <View className="flex-row justify-between items-center">
                  <Text variant="muted" className="font-medium">Muscle Group:</Text>
                  <Text variant="small" className="font-semibold">{exercise.muscleGroup}</Text>
                </View>
                <View className="flex-row justify-between items-center">
                  <Text variant="muted" className="font-medium">Difficulty:</Text>
                  <Text className="text-blue-500 font-semibold">
                    {exercise.difficulty}
                  </Text>
                </View>
                <View className="flex-row justify-between items-center">
                  <Text variant="muted" className="font-medium">Equipment:</Text>
                  <Text variant="small" className="font-semibold">{exercise.equipment}</Text>
                </View>
              </View>
            </CardContent>
          </Button>
        ))}
      </View>
      </View>
    </ScrollView>
  );
}
