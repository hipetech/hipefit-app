import { GlassView } from "expo-glass-effect";
import { Image } from "expo-image";
import { useState } from "react";
import {
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { settingsOptions } from "@/mock/settings";

export default function Settings() {
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [remindersEnabled, setRemindersEnabled] = useState(true);
  const [autoPauseEnabled, setAutoPauseEnabled] = useState(false);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.contentContainer}
    >
      {/* Profile Header */}
      <View style={styles.profileSection}>
        <GlassView style={styles.profileCard} glassEffectStyle="clear">
          <Image
            style={styles.avatar}
            source={{
              uri: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d",
            }}
            contentFit="cover"
            transition={200}
          />
          <View style={styles.profileInfo}>
            <Text style={styles.profileName}>John Doe</Text>
            <Text style={styles.profileEmail}>john.doe@example.com</Text>
            <Text style={styles.profileLevel}>
              Intermediate • Member since 2024
            </Text>
          </View>
        </GlassView>
      </View>

      {/* Settings Sections */}
      {settingsOptions.map((section) => (
        <View key={section.id} style={styles.section}>
          <Text style={styles.sectionTitle}>{section.category}</Text>
          <GlassView style={styles.settingsCard} glassEffectStyle="clear">
            {section.items.map((item, index) => (
              <TouchableOpacity
                key={item.id}
                style={[
                  styles.settingItem,
                  index !== section.items.length - 1 &&
                    styles.settingItemBorder,
                ]}
                disabled={
                  !(item.hasArrow ?? false) && !(item.hasSwitch ?? false)
                }
              >
                <View style={styles.settingLeft}>
                  <Text style={styles.settingIcon}>{item.icon}</Text>
                  <View style={styles.settingTextContainer}>
                    <Text style={styles.settingLabel}>{item.label}</Text>
                    {item.value !== undefined && (
                      <Text style={styles.settingValue}>{item.value}</Text>
                    )}
                  </View>
                </View>
                <View style={styles.settingRight}>
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
                    <Text style={styles.arrow}>›</Text>
                  )}
                </View>
              </TouchableOpacity>
            ))}
          </GlassView>
        </View>
      ))}

      {/* Stats Summary */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Your Stats</Text>
        <GlassView style={styles.statsCard} glassEffectStyle="regular">
          <View style={styles.statRow}>
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>156</Text>
              <Text style={styles.statDescription}>Total Workouts</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>42h</Text>
              <Text style={styles.statDescription}>Time Exercised</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>8.2k</Text>
              <Text style={styles.statDescription}>Calories Burned</Text>
            </View>
          </View>
        </GlassView>
      </View>

      {/* Logout Button */}
      <TouchableOpacity style={styles.logoutButton}>
        <Text style={styles.logoutText}>Log Out</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f5f5f5",
  },
  contentContainer: {
    padding: 20,
    paddingTop: 60,
  },
  profileSection: {
    marginBottom: 30,
  },
  profileCard: {
    flexDirection: "row",
    padding: 20,
    borderRadius: 20,
    alignItems: "center",
  },
  avatar: {
    width: 70,
    height: 70,
    borderRadius: 35,
    marginRight: 16,
  },
  profileInfo: {
    flex: 1,
  },
  profileName: {
    fontSize: 22,
    fontWeight: "700",
    color: "#1a1a1a",
    marginBottom: 4,
  },
  profileEmail: {
    fontSize: 14,
    color: "#666",
    marginBottom: 4,
  },
  profileLevel: {
    fontSize: 12,
    color: "#999",
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#666",
    marginBottom: 12,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  settingsCard: {
    borderRadius: 16,
    overflow: "hidden",
  },
  settingItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 16,
    backgroundColor: "#fff",
  },
  settingItemBorder: {
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
  },
  settingLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  settingIcon: {
    fontSize: 24,
    marginRight: 12,
  },
  settingTextContainer: {
    flex: 1,
  },
  settingLabel: {
    fontSize: 16,
    fontWeight: "500",
    color: "#1a1a1a",
    marginBottom: 2,
  },
  settingValue: {
    fontSize: 14,
    color: "#666",
  },
  settingRight: {
    alignItems: "center",
    justifyContent: "center",
  },
  arrow: {
    fontSize: 24,
    color: "#999",
    fontWeight: "300",
  },
  statsCard: {
    borderRadius: 16,
    padding: 20,
  },
  statRow: {
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center",
  },
  statItem: {
    flex: 1,
    alignItems: "center",
  },
  statDivider: {
    width: 1,
    height: 40,
    backgroundColor: "#e0e0e0",
  },
  statNumber: {
    fontSize: 24,
    fontWeight: "700",
    color: "#1a1a1a",
    marginBottom: 4,
  },
  statDescription: {
    fontSize: 12,
    color: "#666",
    textAlign: "center",
  },
  logoutButton: {
    backgroundColor: "#FF3B30",
    padding: 16,
    borderRadius: 12,
    alignItems: "center",
    marginTop: 20,
    marginBottom: 40,
  },
  logoutText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
});
