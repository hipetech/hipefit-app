import { stats } from "@/mock/home";
import { homeWorkoutData } from "@/mock/workouts";
import { Image } from "@/ui/Image";
import { GlassView } from "expo-glass-effect";
import {
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

export default function Home() {
  return (
    <ScrollView className="flex-1 bg-gray-100">
      <View className="p-5 pt-15">
      <View className="mb-8">
        <Text className="text-3xl font-bold text-gray-900 mb-2">Good Morning! 👋</Text>
        <Text className="text-base text-gray-600">Ready for your workout?</Text>
      </View>

      {/* Stats Cards */}
      <View className="flex-row justify-between mb-8 gap-3">
        {stats.map((stat, index) => (
          <GlassView
            key={index}
            className="flex-1 p-4 rounded-2xl items-center min-h-[100px] justify-center"
            glassEffectStyle="clear"
          >
            <Text className="text-2xl font-bold text-gray-900 mb-1">{stat.value}</Text>
            <Text className="text-xs font-semibold text-gray-600 uppercase">{stat.label}</Text>
            <Text className="text-[10px] text-gray-500 mt-0.5">{stat.unit}</Text>
          </GlassView>
        ))}
      </View>

      {/* Featured Workout */}
      <View className="mb-8">
        <Text className="text-xl font-bold text-gray-900 mb-4">Featured Workout</Text>
        <GlassView className="rounded-2xl overflow-hidden h-[200px]" glassEffectStyle="regular">
          <Image
            className="w-full h-full"
            source={{
              uri: "https://images.unsplash.com/photo-1534438327276-14e5300c3a48",
            }}
            contentFit="cover"
            transition={200}
          />
          <View className="absolute bottom-0 left-0 right-0 p-5 bg-black/30">
            <Text className="text-2xl font-bold text-white mb-1">HIIT Challenge</Text>
            <Text className="text-sm text-white mb-3">High Intensity • 20 min</Text>
            <TouchableOpacity className="bg-blue-500 py-2.5 px-5 rounded-lg self-start">
              <Text className="text-white font-semibold text-sm">Start Now</Text>
            </TouchableOpacity>
          </View>
        </GlassView>
      </View>

      {/* Workout List */}
      <View className="mb-8">
        <Text className="text-xl font-bold text-gray-900 mb-4">Popular Workouts</Text>
        {homeWorkoutData.map((workout) => (
          <TouchableOpacity key={workout.id} className="flex-row bg-white rounded-2xl mb-3 overflow-hidden shadow-sm">
            <Image
              className="w-[100px] h-[100px]"
              source={{ uri: workout.image }}
              contentFit="cover"
              transition={200}
            />
            <View className="flex-1 p-4 justify-center">
              <Text className="text-lg font-semibold text-gray-900 mb-2">{workout.title}</Text>
              <View className="flex-row gap-4">
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
