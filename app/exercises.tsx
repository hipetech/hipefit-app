import { Image } from "@/components/ui/Image";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Text } from "@/components/ui/text";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useState } from "react";
import { Search } from "lucide-react-native";
import {
  ScrollView,
  View,
} from "react-native";
import { exerciseData, muscleGroups } from "@/mock/exercises";

export default function Exercises() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedMuscleGroup, setSelectedMuscleGroup] = useState("All");
  const [difficultyFilter, setDifficultyFilter] = useState("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedExercise, setSelectedExercise] = useState<typeof exerciseData[0] | null>(null);

  const getDifficultyValue = (difficulty: string) => {
    switch (difficulty) {
      case "Beginner": return 33;
      case "Intermediate": return 66;
      case "Advanced": return 100;
      default: return 0;
    }
  };

  const filteredExercises = exerciseData.filter((exercise) => {
    const matchesSearch = exercise.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesMuscleGroup = selectedMuscleGroup === "All" || exercise.muscleGroup.includes(selectedMuscleGroup);
    const matchesDifficulty = difficultyFilter === "all" || exercise.difficulty === difficultyFilter;
    return matchesSearch && matchesMuscleGroup && matchesDifficulty;
  });

  const openExerciseDialog = (exercise: typeof exerciseData[0]) => {
    setSelectedExercise(exercise);
    setDialogOpen(true);
  };

  return (
    <ScrollView className="flex-1 bg-gray-100">
      <View className="p-5 pt-15">
      <View className="mb-6">
        <Text variant="h1" className="mb-2">Exercises</Text>
        <Text variant="muted">Build your exercise library</Text>
      </View>

      {/* Search Input */}
      <View className="mb-4">
        <View className="relative">
          <View className="absolute left-3 top-3 z-10">
            <Search size={20} className="text-muted-foreground" />
          </View>
          <Input
            className="pl-10 bg-white"
            placeholder="Search exercises..."
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>
      </View>

      {/* Difficulty Filter with Radio Group */}
      <Card className="mb-4 p-4">
        <Text variant="small" className="mb-3 uppercase tracking-wide">Filter by Difficulty</Text>
        <RadioGroup value={difficultyFilter} onValueChange={setDifficultyFilter}>
          <View className="flex-row gap-4">
            <View className="flex-row items-center gap-2">
              <RadioGroupItem value="all" id="all" />
              <Label htmlFor="all" className="ml-0">
                <Text variant="small">All</Text>
              </Label>
            </View>
            <View className="flex-row items-center gap-2">
              <RadioGroupItem value="Beginner" id="beginner" />
              <Label htmlFor="beginner" className="ml-0">
                <Text variant="small">Beginner</Text>
              </Label>
            </View>
            <View className="flex-row items-center gap-2">
              <RadioGroupItem value="Intermediate" id="intermediate" />
              <Label htmlFor="intermediate" className="ml-0">
                <Text variant="small">Intermediate</Text>
              </Label>
            </View>
            <View className="flex-row items-center gap-2">
              <RadioGroupItem value="Advanced" id="advanced" />
              <Label htmlFor="advanced" className="ml-0">
                <Text variant="small">Advanced</Text>
              </Label>
            </View>
          </View>
        </RadioGroup>
      </Card>

      {/* Muscle Group Filter */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        className="mb-6"
      >
        <View className="flex-row gap-3">
        {muscleGroups.map((group) => (
          <Button
            key={group}
            variant={selectedMuscleGroup === group ? "default" : "outline"}
            className="mr-2"
            onPress={() => setSelectedMuscleGroup(group)}
          >
            <Text variant="small">{group}</Text>
          </Button>
        ))}
        </View>
      </ScrollView>

      {/* Exercise List with Accordion */}
      <View className="gap-4">
        <Accordion type="single" collapsible className="gap-3">
          {filteredExercises.map((exercise) => (
            <AccordionItem
              key={exercise.id}
              value={`exercise-${exercise.id}`}
              className="bg-white rounded-2xl mb-3 border-0 shadow-sm"
            >
              <AccordionTrigger className="px-0">
                <Button
                  variant="ghost"
                  className="flex-row bg-transparent rounded-2xl overflow-hidden shadow-none p-0 h-auto flex-1"
                  onPress={() => openExerciseDialog(exercise)}
                >
                  <Image
                    className="w-[120px] h-[140px]"
                    source={{ uri: exercise.image }}
                    contentFit="cover"
                    transition={200}
                  />
                  <CardContent className="flex-1 p-4">
                    <View className="flex-row items-start justify-between mb-2">
                      <Text variant="h4" className="flex-1 mr-2">{exercise.name}</Text>
                      <Badge variant="secondary">
                        <Text variant="small" className="text-[10px]">{exercise.difficulty}</Text>
                      </Badge>
                    </View>
                    <View className="gap-2">
                      <View className="flex-row justify-between items-center">
                        <Text variant="muted" className="font-medium text-xs">Muscle Group:</Text>
                        <Text variant="small" className="font-semibold">{exercise.muscleGroup}</Text>
                      </View>
                      <View className="flex-row justify-between items-center">
                        <Text variant="muted" className="font-medium text-xs">Equipment:</Text>
                        <Text variant="small" className="font-semibold">{exercise.equipment}</Text>
                      </View>
                      <View className="gap-1 mt-2">
                        <View className="flex-row justify-between items-center">
                          <Text variant="muted" className="text-xs">Difficulty Level</Text>
                          <Text variant="small" className="font-semibold">{exercise.difficulty}</Text>
                        </View>
                        <Progress value={getDifficultyValue(exercise.difficulty)} />
                      </View>
                    </View>
                  </CardContent>
                </Button>
              </AccordionTrigger>
              <AccordionContent className="px-4 pb-4">
                <Separator className="mb-4" />
                <View className="gap-3">
                  <View className="gap-2">
                    <Text variant="h4" className="text-sm">Instructions</Text>
                    <Text variant="muted" className="text-sm">
                      Follow proper form and technique. Start with lighter weights and gradually increase.
                      Focus on controlled movements and proper breathing.
                    </Text>
                  </View>
                  <View className="flex-row gap-2">
                    <Button variant="outline" className="flex-1" onPress={() => openExerciseDialog(exercise)}>
                      <Text>View Details</Text>
                    </Button>
                    <Button className="flex-1">
                      <Text className="text-white">Add to Workout</Text>
                    </Button>
                  </View>
                </View>
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </View>

      {/* Exercise Detail Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          {selectedExercise && (
            <>
              <DialogHeader>
                <DialogTitle>{selectedExercise.name}</DialogTitle>
                <DialogDescription>
                  {selectedExercise.muscleGroup} • {selectedExercise.equipment}
                </DialogDescription>
              </DialogHeader>
              <View className="gap-4">
                <Image
                  className="w-full h-[200px] rounded-lg"
                  source={{ uri: selectedExercise.image }}
                  contentFit="cover"
                  transition={200}
                />
                <Separator />
                <View className="gap-3">
                  <View className="flex-row items-center justify-between">
                    <Text variant="muted">Difficulty</Text>
                    <Badge variant="secondary">
                      <Text variant="small">{selectedExercise.difficulty}</Text>
                    </Badge>
                  </View>
                  <Progress value={getDifficultyValue(selectedExercise.difficulty)} className="h-2" />
                </View>
                <View className="gap-2">
                  <Text variant="h4" className="mb-2">Instructions</Text>
                  <Text variant="muted">
                    • Maintain proper form throughout the exercise{'\n'}
                    • Control your breathing - exhale on exertion{'\n'}
                    • Start with appropriate weight for your level{'\n'}
                    • Rest 30-60 seconds between sets{'\n'}
                    • Focus on muscle contraction
                  </Text>
                </View>
                <View className="gap-2">
                  <Text variant="h4" className="mb-2">Tips</Text>
                  <Text variant="muted">
                    Keep your core engaged and maintain a neutral spine. If you experience any pain,
                    stop immediately and consult a professional.
                  </Text>
                </View>
              </View>
              <DialogFooter>
                <Button variant="outline" onPress={() => setDialogOpen(false)}>
                  <Text>Close</Text>
                </Button>
                <Button onPress={() => setDialogOpen(false)}>
                  <Text className="text-white">Add to Workout</Text>
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
