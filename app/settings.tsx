import { settingsOptions } from "@/mock/settings";
import { Image } from "@/ui/Image";
import { GlassView } from "expo-glass-effect";
import { useState } from "react";
import {
  ScrollView,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

export default function Settings() {
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [remindersEnabled, setRemindersEnabled] = useState(true);
  const [autoPauseEnabled, setAutoPauseEnabled] = useState(false);

  return (
    <ScrollView className="flex-1 bg-gray-100">
      <View className="p-5 pt-15">
      {/* Profile Header */}
      <View className="mb-8">
        <GlassView className="flex-row p-5 rounded-2xl items-center" glassEffectStyle="clear">
          <Image
            className="w-[70px] h-[70px] rounded-[35px] mr-4"
            source={{
              uri: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d",
            }}
            contentFit="cover"
            transition={200}
          />
          <View className="flex-1">
            <Text className="text-[22px] font-bold text-gray-900 mb-1">John Doe</Text>
            <Text className="text-sm text-gray-600 mb-1">john.doe@example.com</Text>
            <Text className="text-xs text-gray-500">
              Intermediate • Member since 2024
            </Text>
          </View>
        </GlassView>
      </View>

      {/* Settings Sections */}
      {settingsOptions.map((section) => (
        <View key={section.id} className="mb-6">
          <Text className="text-base font-semibold text-gray-600 mb-3 uppercase tracking-wide">{section.category}</Text>
          <GlassView className="rounded-2xl overflow-hidden" glassEffectStyle="clear">
            {section.items.map((item, index) => (
              <TouchableOpacity
                key={item.id}
                className={`flex-row items-center justify-between p-4 bg-white ${
                  index !== section.items.length - 1 ? "border-b border-gray-100" : ""
                }`}
                disabled={
                  !(item.hasArrow ?? false) && !(item.hasSwitch ?? false)
                }
              >
                <View className="flex-row items-center flex-1">
                  <Text className="text-2xl mr-3">{item.icon}</Text>
                  <View className="flex-1">
                    <Text className="text-base font-medium text-gray-900 mb-0.5">{item.label}</Text>
                    {item.value !== undefined && (
                      <Text className="text-sm text-gray-600">{item.value}</Text>
                    )}
                  </View>
                </View>
                <View className="items-center justify-center">
                  {(item.hasSwitch ?? false) && (
                    <Switch
                      value={
                        item.id === "notifications"
                          ? notificationsEnabled
                          : item.id === "reminders"
                          ? remindersEnabled
                          : autoPauseEnabled
                      }
                      onValueChange={(value) => {
                        if (item.id === "notifications") {
                          setNotificationsEnabled(value);
                        } else if (item.id === "reminders") {
                          setRemindersEnabled(value);
                        } else {
                          setAutoPauseEnabled(value);
                        }
                      }}
                      trackColor={{ false: "#767577", true: "#007AFF" }}
                      thumbColor="#fff"
                    />
                  )}
                  {(item.hasArrow ?? false) && (
                    <Text className="text-2xl text-gray-500 font-light">›</Text>
                  )}
                </View>
              </TouchableOpacity>
            ))}
          </GlassView>
        </View>
      ))}

      {/* Stats Summary */}
      <View className="mb-6">
        <Text className="text-base font-semibold text-gray-600 mb-3 uppercase tracking-wide">Your Stats</Text>
        <GlassView className="rounded-2xl p-5" glassEffectStyle="regular">
          <View className="flex-row justify-around items-center">
            <View className="flex-1 items-center">
              <Text className="text-2xl font-bold text-gray-900 mb-1">156</Text>
              <Text className="text-xs text-gray-600 text-center">Total Workouts</Text>
            </View>
            <View className="w-px h-10 bg-gray-300" />
            <View className="flex-1 items-center">
              <Text className="text-2xl font-bold text-gray-900 mb-1">42h</Text>
              <Text className="text-xs text-gray-600 text-center">Time Exercised</Text>
            </View>
            <View className="w-px h-10 bg-gray-300" />
            <View className="flex-1 items-center">
              <Text className="text-2xl font-bold text-gray-900 mb-1">8.2k</Text>
              <Text className="text-xs text-gray-600 text-center">Calories Burned</Text>
            </View>
          </View>
        </GlassView>
      </View>

      {/* Logout Button */}
      <TouchableOpacity className="bg-red-500 p-4 rounded-xl items-center mt-5 mb-10">
        <Text className="text-white text-base font-semibold">Log Out</Text>
      </TouchableOpacity>
      </View>
    </ScrollView>
  );
}
