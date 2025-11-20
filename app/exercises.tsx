import { Image } from "@/ui/Image";
import {
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { exerciseData, muscleGroups } from "../mock/exercises";

export default function Exercises() {
  return (
    <ScrollView className="flex-1 bg-gray-100">
      <View className="p-5 pt-15">
      <View className="mb-6">
        <Text className="text-3xl font-bold text-gray-900 mb-2">Exercises</Text>
        <Text className="text-base text-gray-600">Build your exercise library</Text>
      </View>

      {/* Muscle Group Filter */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        className="mb-6"
      >
        <View className="flex-row gap-3">
        {muscleGroups.map((group) => (
          <TouchableOpacity key={group} className="px-5 py-2.5 rounded-2xl bg-white mr-2">
            <Text className="text-sm font-semibold text-gray-900">{group}</Text>
          </TouchableOpacity>
        ))}
        </View>
      </ScrollView>

      {/* Exercise List */}
      <View className="gap-4">
        {exerciseData.map((exercise) => (
          <TouchableOpacity key={exercise.id} className="flex-row bg-white rounded-2xl overflow-hidden shadow-sm">
            <Image
              className="w-[120px] h-[140px]"
              source={{ uri: exercise.image }}
              contentFit="cover"
              transition={200}
            />
            <View className="flex-1 p-4">
              <Text className="text-xl font-bold text-gray-900 mb-3">{exercise.name}</Text>
              <View className="gap-2">
                <View className="flex-row justify-between items-center">
                  <Text className="text-sm text-gray-600 font-medium">Muscle Group:</Text>
                  <Text className="text-sm text-gray-900 font-semibold">{exercise.muscleGroup}</Text>
                </View>
                <View className="flex-row justify-between items-center">
                  <Text className="text-sm text-gray-600 font-medium">Difficulty:</Text>
                  <Text className="text-sm text-blue-500 font-semibold">
                    {exercise.difficulty}
                  </Text>
                </View>
                <View className="flex-row justify-between items-center">
                  <Text className="text-sm text-gray-600 font-medium">Equipment:</Text>
                  <Text className="text-sm text-gray-900 font-semibold">{exercise.equipment}</Text>
                </View>
              </View>
            </View>
          </TouchableOpacity>
        ))}
      </View>
      </View>
    </ScrollView>
  );
}
