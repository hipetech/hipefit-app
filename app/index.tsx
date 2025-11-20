import { GlassView } from "expo-glass-effect";
import { Image } from "expo-image";
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { stats } from "@/mock/home";
import { homeWorkoutData } from "@/mock/workouts";

export default function Home() {
  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.contentContainer}
    >
      <View style={styles.header}>
        <Text style={styles.greeting}>Good Morning! 👋</Text>
        <Text style={styles.subtitle}>Ready for your workout?</Text>
      </View>

      {/* Stats Cards */}
      <View style={styles.statsContainer}>
        {stats.map((stat, index) => (
          <GlassView
            key={index}
            style={styles.statCard}
            glassEffectStyle="clear"
          >
            <Text style={styles.statValue}>{stat.value}</Text>
            <Text style={styles.statLabel}>{stat.label}</Text>
            <Text style={styles.statUnit}>{stat.unit}</Text>
          </GlassView>
        ))}
      </View>

      {/* Featured Workout */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Featured Workout</Text>
        <GlassView style={styles.featuredCard} glassEffectStyle="regular">
          <Image
            style={styles.featuredImage}
            source={{
              uri: "https://images.unsplash.com/photo-1534438327276-14e5300c3a48",
            }}
            contentFit="cover"
            transition={200}
          />
          <View style={styles.featuredOverlay}>
            <Text style={styles.featuredTitle}>HIIT Challenge</Text>
            <Text style={styles.featuredSubtitle}>High Intensity • 20 min</Text>
            <TouchableOpacity style={styles.startButton}>
              <Text style={styles.startButtonText}>Start Now</Text>
            </TouchableOpacity>
          </View>
        </GlassView>
      </View>

      {/* Workout List */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Popular Workouts</Text>
        {homeWorkoutData.map((workout) => (
          <TouchableOpacity key={workout.id} style={styles.workoutCard}>
            <Image
              style={styles.workoutImage}
              source={{ uri: workout.image }}
              contentFit="cover"
              transition={200}
            />
            <View style={styles.workoutInfo}>
              <Text style={styles.workoutTitle}>{workout.title}</Text>
              <View style={styles.workoutMeta}>
                <Text style={styles.workoutDuration}>⏱ {workout.duration}</Text>
                <Text style={styles.workoutDifficulty}>
                  {workout.difficulty}
                </Text>
              </View>
            </View>
          </TouchableOpacity>
        ))}
      </View>
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
  header: {
    marginBottom: 30,
  },
  greeting: {
    fontSize: 32,
    fontWeight: "700",
    color: "#1a1a1a",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: "#666",
  },
  statsContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 30,
    gap: 12,
  },
  statCard: {
    flex: 1,
    padding: 16,
    borderRadius: 16,
    alignItems: "center",
    minHeight: 100,
    justifyContent: "center",
  },
  statValue: {
    fontSize: 24,
    fontWeight: "700",
    color: "#1a1a1a",
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: "#666",
    textTransform: "uppercase",
  },
  statUnit: {
    fontSize: 10,
    color: "#999",
    marginTop: 2,
  },
  section: {
    marginBottom: 30,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#1a1a1a",
    marginBottom: 16,
  },
  featuredCard: {
    borderRadius: 20,
    overflow: "hidden",
    height: 200,
  },
  featuredImage: {
    width: "100%",
    height: "100%",
  },
  featuredOverlay: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    padding: 20,
    backgroundColor: "rgba(0,0,0,0.3)",
  },
  featuredTitle: {
    fontSize: 24,
    fontWeight: "700",
    color: "#fff",
    marginBottom: 4,
  },
  featuredSubtitle: {
    fontSize: 14,
    color: "#fff",
    marginBottom: 12,
  },
  startButton: {
    backgroundColor: "#007AFF",
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignSelf: "flex-start",
  },
  startButtonText: {
    color: "#fff",
    fontWeight: "600",
    fontSize: 14,
  },
  workoutCard: {
    flexDirection: "row",
    backgroundColor: "#fff",
    borderRadius: 16,
    marginBottom: 12,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  workoutImage: {
    width: 100,
    height: 100,
  },
  workoutInfo: {
    flex: 1,
    padding: 16,
    justifyContent: "center",
  },
  workoutTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#1a1a1a",
    marginBottom: 8,
  },
  workoutMeta: {
    flexDirection: "row",
    gap: 16,
  },
  workoutDuration: {
    fontSize: 14,
    color: "#666",
  },
  workoutDifficulty: {
    fontSize: 14,
    color: "#007AFF",
    fontWeight: "600",
  },
});
