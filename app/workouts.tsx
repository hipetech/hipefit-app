import { Image } from "@/components/ui/Image";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Text } from "@/components/ui/text";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { useState } from "react";
import { Search, Grid, List } from "lucide-react-native";
import {
  ScrollView,
  View,
} from "react-native";
import { categories, workoutData } from "@/mock/workouts";

export default function Workouts() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [viewMode, setViewMode] = useState("list");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedWorkout, setSelectedWorkout] = useState<typeof workoutData[0] | null>(null);

  const filteredWorkouts = workoutData.filter((workout) => {
    const matchesSearch = workout.title.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === "All" || workout.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const openWorkoutDialog = (workout: typeof workoutData[0]) => {
    setSelectedWorkout(workout);
    setDialogOpen(true);
  };

  return (
    <ScrollView className="flex-1 bg-gray-100">
      <View className="p-5 pt-15">
      <View className="mb-6">
        <Text variant="h1" className="mb-2">Workouts</Text>
        <Text variant="muted">Choose your next challenge</Text>
      </View>

      {/* Search Input */}
      <View className="mb-4">
        <View className="relative">
          <View className="absolute left-3 top-3 z-10">
            <Search size={20} className="text-muted-foreground" />
          </View>
          <Input
            className="pl-10 bg-white"
            placeholder="Search workouts..."
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>
      </View>

      {/* View Mode Toggle */}
      <View className="flex-row items-center justify-between mb-4">
        <ToggleGroup
          type="single"
          value={viewMode}
          onValueChange={(value) => value && setViewMode(value)}
        >
          <ToggleGroupItem value="list" aria-label="List view">
            <List size={16} />
          </ToggleGroupItem>
          <ToggleGroupItem value="grid" aria-label="Grid view">
            <Grid size={16} />
          </ToggleGroupItem>
        </ToggleGroup>
      </View>

      {/* Category Filter */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        className="mb-6"
      >
        <View className="flex-row gap-3">
          {categories.map((category) => (
            <Button
              key={category}
              variant={selectedCategory === category ? "default" : "outline"}
              className="mr-2"
              onPress={() => setSelectedCategory(category)}
            >
              <Text variant="small">{category}</Text>
            </Button>
          ))}
        </View>
      </ScrollView>

      {/* Workout List */}
      <View className="gap-4">
        {filteredWorkouts.map((workout) => (
          <Card
            key={workout.id}
            className="bg-white rounded-2xl overflow-hidden shadow-sm"
          >
            <Button
              variant="ghost"
              className="flex-row p-0 h-auto"
              onPress={() => openWorkoutDialog(workout)}
            >
              <View className="flex-row flex-1">
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
                  <View className="gap-2">
                    <View className="flex-row gap-4 items-center">
                      <Text variant="muted">⏱ {workout.duration}</Text>
                      <Text className="text-blue-500 font-semibold">
                        {workout.difficulty}
                      </Text>
                    </View>
                    <View className="gap-1">
                      <View className="flex-row justify-between items-center">
                        <Text variant="muted" className="text-xs">Progress</Text>
                        <Text variant="small" className="font-semibold">0%</Text>
                      </View>
                      <Progress value={0} />
                    </View>
                  </View>
                </CardContent>
              </View>
            </Button>
          </Card>
        ))}
      </View>

      {/* Workout Detail Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          {selectedWorkout && (
            <>
              <DialogHeader>
                <DialogTitle>{selectedWorkout.title}</DialogTitle>
                <DialogDescription>
                  {selectedWorkout.category} • {selectedWorkout.duration} • {selectedWorkout.difficulty}
                </DialogDescription>
              </DialogHeader>
              <View className="gap-4">
                <Image
                  className="w-full h-[200px] rounded-lg"
                  source={{ uri: selectedWorkout.image }}
                  contentFit="cover"
                  transition={200}
                />
                <Separator />
                <View className="gap-3">
                  <View className="flex-row justify-between items-center">
                    <Text variant="muted">Workout Progress</Text>
                    <Text className="font-semibold">0%</Text>
                  </View>
                  <Progress value={0} className="h-2" />
                </View>
                <View className="gap-2">
                  <Text variant="h4" className="mb-2">Description</Text>
                  <Text variant="muted">
                    A comprehensive workout designed to challenge your entire body. This session includes
                    strength training, cardio intervals, and flexibility exercises.
                  </Text>
                </View>
              </View>
              <DialogFooter>
                <Button variant="outline" onPress={() => setDialogOpen(false)}>
                  <Text>Close</Text>
                </Button>
                <Button onPress={() => setDialogOpen(false)}>
                  <Text className="text-white">Start Workout</Text>
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
      </View>
    </ScrollView>
  );
}
