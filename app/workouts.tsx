import { Image } from "@/ui/Image";
import {
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { categories, workoutData } from "../mock/workouts";

export default function Workouts() {
  return (
    <ScrollView className="flex-1 bg-gray-100">
      <View className="p-5 pt-15">
      <View className="mb-6">
        <Text className="text-3xl font-bold text-gray-900 mb-2">Workouts</Text>
        <Text className="text-base text-gray-600">Choose your next challenge</Text>
      </View>

      {/* Category Filter */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        className="mb-6"
      >
        <View className="flex-row gap-3">
        {categories.map((category) => (
          <TouchableOpacity key={category} className="px-5 py-2.5 rounded-2xl bg-white mr-2">
            <Text className="text-sm font-semibold text-gray-900">{category}</Text>
          </TouchableOpacity>
        ))}
        </View>
      </ScrollView>

      {/* Workout List */}
      <View className="gap-4">
        {workoutData.map((workout) => (
          <TouchableOpacity key={workout.id} className="flex-row bg-white rounded-2xl overflow-hidden shadow-sm">
            <Image
              className="w-[120px] h-[120px]"
              source={{ uri: workout.image }}
              contentFit="cover"
              transition={200}
            />
            <View className="flex-1 p-4 justify-between">
              <View className="flex-row justify-between items-start mb-2">
                <Text className="text-lg font-semibold text-gray-900 flex-1 mr-2">{workout.title}</Text>
                <View className="bg-blue-500 px-2 py-1 rounded-md">
                  <Text className="text-[10px] font-semibold text-white uppercase">
                    {workout.category}
                  </Text>
                </View>
              </View>
              <View className="flex-row gap-4 items-center">
                <Text className="text-sm text-gray-600">⏱ {workout.duration}</Text>
                <Text className="text-sm text-blue-500 font-semibold">
                  {workout.difficulty}
                </Text>
              </View>
            </View>
          </TouchableOpacity>
        ))}
      </View>
      </View>
    </ScrollView>
  );
}
