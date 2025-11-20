import { Image } from "expo-image";
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { exerciseData, muscleGroups } from "../mock/exercises";

export default function Exercises() {
  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.contentContainer}
    >
      <View style={styles.header}>
        <Text style={styles.title}>Exercises</Text>
        <Text style={styles.subtitle}>Build your exercise library</Text>
      </View>

      {/* Muscle Group Filter */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.filterContainer}
        contentContainerStyle={styles.filterContent}
      >
        {muscleGroups.map((group) => (
          <TouchableOpacity key={group} style={styles.filterChip}>
            <Text style={styles.filterText}>{group}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Exercise List */}
      <View style={styles.exercisesList}>
        {exerciseData.map((exercise) => (
          <TouchableOpacity key={exercise.id} style={styles.exerciseCard}>
            <Image
              style={styles.exerciseImage}
              source={{ uri: exercise.image }}
              contentFit="cover"
              transition={200}
            />
            <View style={styles.exerciseInfo}>
              <Text style={styles.exerciseName}>{exercise.name}</Text>
              <View style={styles.exerciseDetails}>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Muscle Group:</Text>
                  <Text style={styles.detailValue}>{exercise.muscleGroup}</Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Difficulty:</Text>
                  <Text style={[styles.detailValue, styles.difficultyText]}>
                    {exercise.difficulty}
                  </Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Equipment:</Text>
                  <Text style={styles.detailValue}>{exercise.equipment}</Text>
                </View>
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
  filterContainer: {
    marginBottom: 24,
  },
  filterContent: {
    gap: 12,
  },
  filterChip: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: "#fff",
    marginRight: 8,
  },
  filterText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#1a1a1a",
  },
  exercisesList: {
    gap: 16,
  },
  exerciseCard: {
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
  exerciseImage: {
    width: 120,
    height: 140,
  },
  exerciseInfo: {
    flex: 1,
    padding: 16,
  },
  exerciseName: {
    fontSize: 20,
    fontWeight: "700",
    color: "#1a1a1a",
    marginBottom: 12,
  },
  exerciseDetails: {
    gap: 8,
  },
  detailRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  detailLabel: {
    fontSize: 14,
    color: "#666",
    fontWeight: "500",
  },
  detailValue: {
    fontSize: 14,
    color: "#1a1a1a",
    fontWeight: "600",
  },
  difficultyText: {
    color: "#007AFF",
  },
});
