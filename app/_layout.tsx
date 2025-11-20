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
      <NativeTabs.Trigger name="index">
        <Label>Home</Label>
        {Platform.select({
          ios: <Icon sf="house.fill" />,
          android: (
            <Icon src={<VectorIcon family={MaterialIcons} name="home" />} />
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
