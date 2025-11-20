import { stats } from "@/mock/home";
import { homeWorkoutData } from "@/mock/workouts";
import { Image } from "@/components/ui/Image";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Text } from "@/components/ui/text";
import {
  ScrollView,
  View,
} from "react-native";

export default function Home() {
  return (
    <ScrollView className="flex-1 bg-gray-100">
      <View className="p-5 pt-15">
      <View className="mb-8">
        <Text variant="h1" className="mb-2">Good Morning! 👋</Text>
        <Text variant="muted">Ready for your workout?</Text>
      </View>

      {/* Stats Cards */}
      <View className="flex-row justify-between mb-8 gap-3">
        {stats.map((stat, index) => (
          <Card key={index} className="flex-1 min-h-[100px] justify-center">
            <CardContent className="p-4 items-center justify-center">
              <Text className="text-2xl font-bold mb-1">{stat.value}</Text>
              <Text variant="small" className="uppercase">{stat.label}</Text>
              <Text variant="muted" className="text-[10px] mt-0.5">{stat.unit}</Text>
            </CardContent>
          </Card>
        ))}
      </View>

      {/* Featured Workout */}
      <View className="mb-8">
        <Text variant="h4" className="mb-4">Featured Workout</Text>
        <Card className="overflow-hidden h-[200px] p-0">
          <View className="relative w-full h-full">
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
              <Button className="self-start">
                <Text className="text-white font-semibold text-sm">Start Now</Text>
              </Button>
            </View>
          </View>
        </Card>
      </View>

      {/* Workout List */}
      <View className="mb-8">
        <Text variant="h4" className="mb-4">Popular Workouts</Text>
        {homeWorkoutData.map((workout) => (
          <Button
            key={workout.id}
            variant="ghost"
            className="flex-row bg-white rounded-2xl mb-3 overflow-hidden shadow-sm p-0 h-auto"
          >
            <Image
              className="w-[100px] h-[100px]"
              source={{ uri: workout.image }}
              contentFit="cover"
              transition={200}
            />
            <View className="flex-1 p-4 justify-center">
              <Text className="text-lg font-semibold mb-2">{workout.title}</Text>
              <View className="flex-row gap-4">
                <Text variant="muted">⏱ {workout.duration}</Text>
                <Text className="text-blue-500 font-semibold">
                  {workout.difficulty}
                </Text>
              </View>
            </View>
          </Button>
        ))}
      </View>
      </View>
    </ScrollView>
  );
}
