import { Image } from "@/components/ui/Image";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Text } from "@/components/ui/text";
import { stats } from "@/mock/home";
import { homeWorkoutData } from "@/mock/workouts";
import { Info, Search } from "lucide-react-native";
import { useState } from "react";
import {
  ScrollView,
  View,
} from "react-native";

export default function Home() {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState("all");

  return (
    <ScrollView className="flex-1 bg-gray-100">
      <View className="p-5 pt-15">
      {/* Header with Avatar */}
      <View className="flex-row items-center justify-between mb-6">
        <View className="flex-1">
          <Text variant="h1" className="mb-2">Good Morning! 👋</Text>
          <Text variant="muted">Ready for your workout?</Text>
        </View>
        <Avatar className="w-12 h-12" alt="User avatar">
          <AvatarImage
            source={{
              uri: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d",
            }}
          />
          <AvatarFallback>
            <Text>JD</Text>
          </AvatarFallback>
        </Avatar>
      </View>

      {/* Search Input */}
      <View className="mb-6">
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

      {/* Alert Notification */}
      <Alert className="mb-6" icon={Info}>
        <AlertTitle>Daily Goal Progress</AlertTitle>
        <AlertDescription>
          You&#39;re 75% towards your daily workout goal. Keep it up! 💪
        </AlertDescription>
        <View className="mt-3">
          <Progress value={75} className="h-2" />
        </View>
      </Alert>

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

      {/* Tabs for Workout Categories */}
      <View className="mb-6">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="w-full">
            <TabsTrigger value="all" className="flex-1">
              <Text variant="small">All</Text>
            </TabsTrigger>
            <TabsTrigger value="featured" className="flex-1">
              <Text variant="small">Featured</Text>
            </TabsTrigger>
            <TabsTrigger value="popular" className="flex-1">
              <Text variant="small">Popular</Text>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="all" className="mt-4">
            <View>
              {/* Featured Workout */}
              <View className="mb-8">
                <View className="flex-row items-center justify-between mb-4">
                  <Text variant="h4">Featured Workout</Text>
                  <Badge variant="secondary">
                    <Text variant="small">New</Text>
                  </Badge>
                </View>
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
                      <Text className="text-sm text-white mb-2">High Intensity • 20 min</Text>
                      <View className="mb-3">
                        <Progress value={0} className="h-1" />
                      </View>
                      <Button className="self-start">
                        <Text className="text-white font-semibold text-sm">Start Now</Text>
                      </Button>
                    </View>
                  </View>
                </Card>
              </View>

              {/* Workout List with Accordion */}
              <View className="mb-8">
                <Text variant="h4" className="mb-4">Popular Workouts</Text>
                <Accordion type="single" collapsible className="gap-3">
                  {homeWorkoutData.map((workout, index) => (
                    <AccordionItem
                      key={workout.id}
                      value={`workout-${workout.id}`}
                      className="bg-white rounded-2xl mb-3 border-0 shadow-sm"
                    >
                      <AccordionTrigger className="px-0">
                        <Button
                          variant="ghost"
                          className="flex-row bg-transparent rounded-2xl overflow-hidden shadow-none p-0 h-auto flex-1"
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
                      </AccordionTrigger>
                      <AccordionContent className="px-4 pb-4">
                        <Separator className="mb-4" />
                        <View className="gap-3">
                          <View className="flex-row justify-between items-center">
                            <Text variant="muted">Progress</Text>
                            <Text className="font-semibold">0%</Text>
                          </View>
                          <Progress value={0} className="h-2" />
                          <View className="flex-row gap-2">
                            <Button variant="outline" className="flex-1">
                              <Text>View Details</Text>
                            </Button>
                            <Button className="flex-1">
                              <Text className="text-white">Start Workout</Text>
                            </Button>
                          </View>
                        </View>
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              </View>
            </View>
          </TabsContent>

          <TabsContent value="featured" className="mt-4">
            <View>
              <Card className="overflow-hidden h-[200px] p-0 mb-4">
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
          </TabsContent>

          <TabsContent value="popular" className="mt-4">
            <View className="gap-3">
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
          </TabsContent>
        </Tabs>
      </View>
      </View>
    </ScrollView>
  );
}
