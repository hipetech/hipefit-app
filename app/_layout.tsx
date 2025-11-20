import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import {
  Icon,
  Label,
  NativeTabs,
  VectorIcon,
} from "expo-router/unstable-native-tabs";
import { Platform } from "react-native";

export default function TabLayout() {
  return (
    <NativeTabs>
      <NativeTabs.Trigger name="workouts">
        <Label>Workouts</Label>
        {Platform.select({
          ios: <Icon sf="dumbbell.fill" />,
          android: (
            <Icon
              src={<VectorIcon family={MaterialIcons} name="fitness-center" />}
            />
          ),
        })}
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="exercises">
        <Label>Exercises</Label>
        {Platform.select({
          ios: <Icon sf="figure.run" />,
          android: (
            <Icon
              src={<VectorIcon family={MaterialIcons} name="directions-run" />}
            />
          ),
        })}
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="settings">
        <Label>Settings</Label>
        {Platform.select({
          ios: <Icon sf="gear" />,
          android: (
            <Icon src={<VectorIcon family={MaterialIcons} name="settings" />} />
          ),
        })}
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
