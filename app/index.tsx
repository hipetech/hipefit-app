import { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { Info, Search } from 'lucide-react-native';

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Image } from '@/components/ui/Image';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Text } from '@/components/ui/text';
import { stats } from '@/mock/home';
import { homeWorkoutData } from '@/mock/workouts';

export default function Home() {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState('all');

  return (
    <ScrollView className="flex-1 bg-gray-100">
      <View className="pt-15 p-5">
        {/* Header with Avatar */}
        <View className="mb-6 flex-row items-center justify-between">
          <View className="flex-1">
            <Text variant="h1" className="mb-2">
              Good Morning! 👋
            </Text>
            <Text variant="muted">Ready for your workout?</Text>
          </View>
          <Avatar className="h-12 w-12" alt="User avatar">
            <AvatarImage
              source={{
                uri: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d',
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
              className="bg-white pl-10"
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
        <View className="mb-8 flex-row justify-between gap-3">
          {stats.map((stat, index) => (
            <Card key={index} className="min-h-[100px] flex-1 justify-center">
              <CardContent className="items-center justify-center p-4">
                <Text className="mb-1 text-2xl font-bold">{stat.value}</Text>
                <Text variant="small" className="uppercase">
                  {stat.label}
                </Text>
                <Text variant="muted" className="mt-0.5 text-[10px]">
                  {stat.unit}
                </Text>
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
                  <View className="mb-4 flex-row items-center justify-between">
                    <Text variant="h4">Featured Workout</Text>
                    <Badge variant="secondary">
                      <Text variant="small">New</Text>
                    </Badge>
                  </View>
                  <Card className="h-[200px] overflow-hidden p-0">
                    <View className="relative h-full w-full">
                      <Image
                        className="h-full w-full"
                        source={{
                          uri: 'https://images.unsplash.com/photo-1534438327276-14e5300c3a48',
                        }}
                        contentFit="cover"
                        transition={200}
                      />
                      <View className="absolute bottom-0 left-0 right-0 bg-black/30 p-5">
                        <Text className="mb-1 text-2xl font-bold text-white">
                          HIIT Challenge
                        </Text>
                        <Text className="mb-2 text-sm text-white">
                          High Intensity • 20 min
                        </Text>
                        <View className="mb-3">
                          <Progress value={0} className="h-1" />
                        </View>
                        <Button className="self-start">
                          <Text className="text-sm font-semibold text-white">
                            Start Now
                          </Text>
                        </Button>
                      </View>
                    </View>
                  </Card>
                </View>

                {/* Workout List with Accordion */}
                <View className="mb-8">
                  <Text variant="h4" className="mb-4">
                    Popular Workouts
                  </Text>
                  <Accordion type="single" collapsible className="gap-3">
                    {homeWorkoutData.map((workout, index) => (
                      <AccordionItem
                        key={workout.id}
                        value={`workout-${workout.id}`}
                        className="mb-3 rounded-2xl border-0 bg-white shadow-sm"
                      >
                        <AccordionTrigger className="px-0">
                          <Button
                            variant="ghost"
                            className="h-auto flex-1 flex-row overflow-hidden rounded-2xl bg-transparent p-0 shadow-none"
                          >
                            <Image
                              className="h-[100px] w-[100px]"
                              source={{ uri: workout.image }}
                              contentFit="cover"
                              transition={200}
                            />
                            <View className="flex-1 justify-center p-4">
                              <Text className="mb-2 text-lg font-semibold">
                                {workout.title}
                              </Text>
                              <View className="flex-row gap-4">
                                <Text variant="muted">
                                  ⏱ {workout.duration}
                                </Text>
                                <Text className="font-semibold text-blue-500">
                                  {workout.difficulty}
                                </Text>
                              </View>
                            </View>
                          </Button>
                        </AccordionTrigger>
                        <AccordionContent className="px-4 pb-4">
                          <Separator className="mb-4" />
                          <View className="gap-3">
                            <View className="flex-row items-center justify-between">
                              <Text variant="muted">Progress</Text>
                              <Text className="font-semibold">0%</Text>
                            </View>
                            <Progress value={0} className="h-2" />
                            <View className="flex-row gap-2">
                              <Button variant="outline" className="flex-1">
                                <Text>View Details</Text>
                              </Button>
                              <Button className="flex-1">
                                <Text className="text-white">
                                  Start Workout
                                </Text>
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
                <Card className="mb-4 h-[200px] overflow-hidden p-0">
                  <View className="relative h-full w-full">
                    <Image
                      className="h-full w-full"
                      source={{
                        uri: 'https://images.unsplash.com/photo-1534438327276-14e5300c3a48',
                      }}
                      contentFit="cover"
                      transition={200}
                    />
                    <View className="absolute bottom-0 left-0 right-0 bg-black/30 p-5">
                      <Text className="mb-1 text-2xl font-bold text-white">
                        HIIT Challenge
                      </Text>
                      <Text className="mb-3 text-sm text-white">
                        High Intensity • 20 min
                      </Text>
                      <Button className="self-start">
                        <Text className="text-sm font-semibold text-white">
                          Start Now
                        </Text>
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
                    className="mb-3 h-auto flex-row overflow-hidden rounded-2xl bg-white p-0 shadow-sm"
                  >
                    <Image
                      className="h-[100px] w-[100px]"
                      source={{ uri: workout.image }}
                      contentFit="cover"
                      transition={200}
                    />
                    <View className="flex-1 justify-center p-4">
                      <Text className="mb-2 text-lg font-semibold">
                        {workout.title}
                      </Text>
                      <View className="flex-row gap-4">
                        <Text variant="muted">⏱ {workout.duration}</Text>
                        <Text className="font-semibold text-blue-500">
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
