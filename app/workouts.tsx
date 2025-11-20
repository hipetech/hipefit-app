import { Image } from "expo-image";
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { categories, workoutData } from "../mock/workouts";

export default function Workouts() {
  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.contentContainer}
    >
      <View style={styles.header}>
        <Text style={styles.title}>Workouts</Text>
        <Text style={styles.subtitle}>Choose your next challenge</Text>
      </View>

      {/* Category Filter */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.categoryContainer}
        contentContainerStyle={styles.categoryContent}
      >
        {categories.map((category) => (
          <TouchableOpacity key={category} style={styles.categoryChip}>
            <Text style={styles.categoryText}>{category}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Workout List */}
      <View style={styles.workoutsList}>
        {workoutData.map((workout) => (
          <TouchableOpacity key={workout.id} style={styles.workoutCard}>
            <Image
              style={styles.workoutImage}
              source={{ uri: workout.image }}
              contentFit="cover"
              transition={200}
            />
            <View style={styles.workoutInfo}>
              <View style={styles.workoutHeader}>
                <Text style={styles.workoutTitle}>{workout.title}</Text>
                <View style={styles.categoryBadge}>
                  <Text style={styles.categoryBadgeText}>
                    {workout.category}
                  </Text>
                </View>
              </View>
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
    marginBottom: 24,
  },
  title: {
    fontSize: 32,
    fontWeight: "700",
    color: "#1a1a1a",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: "#666",
  },
  categoryContainer: {
    marginBottom: 24,
  },
  categoryContent: {
    gap: 12,
  },
  categoryChip: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: "#fff",
    marginRight: 8,
  },
  categoryText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#1a1a1a",
  },
  workoutsList: {
    gap: 16,
  },
  workoutCard: {
    flexDirection: "row",
    backgroundColor: "#fff",
    borderRadius: 16,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  workoutImage: {
    width: 120,
    height: 120,
  },
  workoutInfo: {
    flex: 1,
    padding: 16,
    justifyContent: "space-between",
  },
  workoutHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 8,
  },
  workoutTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#1a1a1a",
    flex: 1,
    marginRight: 8,
  },
  categoryBadge: {
    backgroundColor: "#007AFF",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  categoryBadgeText: {
    fontSize: 10,
    fontWeight: "600",
    color: "#fff",
    textTransform: "uppercase",
  },
  workoutMeta: {
    flexDirection: "row",
    gap: 16,
    alignItems: "center",
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
