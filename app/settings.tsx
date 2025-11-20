import { Image } from "@/components/ui/Image";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Text } from "@/components/ui/text";
import { settingsOptions } from "@/mock/settings";
import { useState } from "react";
import {
  Pressable,
  ScrollView,
  View,
} from "react-native";

export default function Settings() {
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [remindersEnabled, setRemindersEnabled] = useState(true);
  const [autoPauseEnabled, setAutoPauseEnabled] = useState(false);

  return (
    <ScrollView className="flex-1 bg-gray-100">
      <View className="p-4 pt-12">
      {/* Profile Header */}
      <View className="mb-6">
        <Card className="flex-row p-4 items-center">
          <Image
            className="w-[70px] h-[70px] rounded-[35px] mr-4"
            source={{
              uri: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d",
            }}
            contentFit="cover"
            transition={200}
          />
          <View className="flex-1">
            <Text variant="h3" className="mb-1">John Doe</Text>
            <Text variant="muted" className="mb-1">john.doe@example.com</Text>
            <Text variant="muted" className="text-xs">
              Intermediate • Member since 2024
            </Text>
          </View>
        </Card>
      </View>

      {/* Settings Sections */}
      {settingsOptions.map((section) => (
        <View key={section.id} className="mb-5">
          <Text variant="small" className="mb-2 uppercase tracking-wide">{section.category}</Text>
          <Card className="overflow-hidden">
            {section.items.map((item, index) => (
              <View key={item.id}>
                <Pressable
                  className="flex-row items-center justify-between p-3 w-full"
                  disabled={
                    !(item.hasArrow ?? false) && !(item.hasSwitch ?? false)
                  }
                >
                  <View className="flex-row items-center flex-1">
                    <View className="w-12 h-12 items-center justify-center mr-4">
                      <Text className="text-3xl">{item.icon}</Text>
                    </View>
                    <View className="flex-1">
                      <Text className="text-base font-medium mb-0.5">{item.label}</Text>
                      {item.value !== undefined && (
                        <Text variant="muted" className="text-sm">{item.value}</Text>
                      )}
                    </View>
                  </View>
                  <View className="items-center justify-center">
                    {(item.hasSwitch ?? false) && (
                      <Switch
                        checked={
                          item.id === "notifications"
                            ? notificationsEnabled
                            : item.id === "reminders"
                            ? remindersEnabled
                            : autoPauseEnabled
                        }
                        onCheckedChange={(value) => {
                          if (item.id === "notifications") {
                            setNotificationsEnabled(value);
                          } else if (item.id === "reminders") {
                            setRemindersEnabled(value);
                          } else {
                            setAutoPauseEnabled(value);
                          }
                        }}
                      />
                    )}
                    {(item.hasArrow ?? false) && (
                      <Text className="text-2xl text-gray-500 font-light">›</Text>
                    )}
                  </View>
                </Pressable>
                {index !== section.items.length - 1 && (
                  <Separator className="mx-3" />
                )}
              </View>
            ))}
          </Card>
        </View>
      ))}

      {/* Stats Summary */}
      <View className="mb-5">
        <Text variant="small" className="mb-2 uppercase tracking-wide">Your Stats</Text>
        <Card className="p-4">
          <CardContent className="flex-row justify-around items-center p-0">
            <View className="flex-1 items-center">
              <Text className="text-2xl font-bold mb-1">156</Text>
              <Text variant="muted" className="text-xs text-center">Total Workouts</Text>
            </View>
            <Separator orientation="vertical" className="h-10" />
            <View className="flex-1 items-center">
              <Text className="text-2xl font-bold mb-1">42h</Text>
              <Text variant="muted" className="text-xs text-center">Time Exercised</Text>
            </View>
            <Separator orientation="vertical" className="h-10" />
            <View className="flex-1 items-center">
              <Text className="text-2xl font-bold mb-1">8.2k</Text>
              <Text variant="muted" className="text-xs text-center">Calories Burned</Text>
            </View>
          </CardContent>
        </Card>
      </View>

      {/* Logout Button */}
      <Button variant="destructive" className="mt-4 mb-8">
        <Text className="text-white text-base font-semibold">Log Out</Text>
      </Button>
      </View>
    </ScrollView>
  );
}
