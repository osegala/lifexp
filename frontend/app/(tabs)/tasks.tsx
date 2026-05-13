import { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
  Alert,
  ScrollView,
} from "react-native";

import { api } from "../../src/api/client";
import LifeButton from "../../src/components/LifeButton";
import LifeCard from "../../src/components/LifeCard";
import LifeInput from "../../src/components/LifeInput";
import { colors, spacing, radius } from "../../src/theme/theme";
import {
  guessCategory,
  getXPForCategory,
  PREMADE_TASKS,
  TASK_CATEGORIES,
  TaskCategory,
} from "../../src/utils/taskCategories";

type Task = {
  id: number;
  title: string;
  description?: string;
  xpValue: number;
  category?: string;
  completed: boolean;
};

export default function TasksScreen() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [title, setTitle] = useState("");
  const [selectedCategory, setSelectedCategory] =
    useState<TaskCategory>("Personal Growth");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadTasks();
  }, []);

  useEffect(() => {
    if (title.trim().length > 0) {
      setSelectedCategory(guessCategory(title));
    }
  }, [title]);

  async function loadTasks() {
    try {
      const response = await api.get("/tasks");
      setTasks(response.data);
    } catch (error) {
      console.log("Load tasks error:", error);
      Alert.alert("Error", "Could not load tasks.");
    }
  }

  async function createTask(
    customTitle?: string,
    customCategory?: TaskCategory,
  ) {
    const finalTitle = customTitle ?? title;
    const finalCategory = customCategory ?? selectedCategory;

    if (!finalTitle.trim()) {
      Alert.alert("Missing title", "Please enter a task name.");
      return;
    }

    const xpValue = getXPForCategory(finalCategory);

    try {
      setLoading(true);

      await api.post("/tasks", {
        title: finalTitle,
        description: finalCategory,
        category: finalCategory,
        xpValue,
      });

      setTitle("");
      setSelectedCategory("Personal Growth");
      await loadTasks();
    } catch (error) {
      console.log("Create task error:", error);
      Alert.alert("Error", "Could not create task.");
    } finally {
      setLoading(false);
    }
  }

  async function completeTask(id: number) {
    try {
      await api.put(`/tasks/${id}/complete`);
      await loadTasks();
    } catch (error) {
      console.log("Complete task error:", error);
      Alert.alert("Error", "Could not complete task.");
    }
  }

  async function deleteTask(id: number) {
    try {
      await api.delete(`/tasks/${id}`);
      await loadTasks();
    } catch (error) {
      console.log("Delete task error:", error);
      Alert.alert("Error", "Could not delete task.");
    }
  }

  const categoryXP = getXPForCategory(selectedCategory);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Tasks</Text>
      <Text style={styles.subtitle}>
        Create tasks, earn XP, and build your streak.
      </Text>

      <LifeCard>
        <Text style={styles.cardTitle}>Create New Task</Text>

        <LifeInput
          placeholder="Example: Finish homework"
          value={title}
          onChangeText={setTitle}
        />

        <Text style={styles.label}>Detected Category</Text>

        <View style={styles.categoryContainer}>
          {Object.keys(TASK_CATEGORIES).map((category) => (
            <Pressable
              key={category}
              onPress={() => setSelectedCategory(category as TaskCategory)}
              style={[
                styles.categoryChip,
                selectedCategory === category && styles.selectedChip,
              ]}
            >
              <Text
                style={[
                  styles.categoryText,
                  selectedCategory === category && styles.selectedChipText,
                ]}
              >
                {category}
              </Text>
            </Pressable>
          ))}
        </View>

        <Text style={styles.xpPreview}>Reward: +{categoryXP} XP</Text>

        <LifeButton
          title={loading ? "Creating..." : "Create Task"}
          onPress={() => createTask()}
        />
      </LifeCard>

      <LifeCard>
        <Text style={styles.cardTitle}>Premade Tasks</Text>

        <View style={styles.premadeContainer}>
          {PREMADE_TASKS.map((task) => (
            <Pressable
              key={task.title}
              style={styles.premadeTask}
              onPress={() => createTask(task.title, task.category)}
            >
              <Text style={styles.premadeTitle}>{task.title}</Text>
              <Text style={styles.premadeMeta}>
                {task.category} · +{getXPForCategory(task.category)} XP
              </Text>
            </Pressable>
          ))}
        </View>
      </LifeCard>

      <Text style={styles.sectionTitle}>Your Tasks</Text>

      <FlatList
        data={tasks}
        keyExtractor={(item) => String(item.id)}
        scrollEnabled={false}
        contentContainerStyle={{ gap: spacing.md }}
        ListEmptyComponent={
          <Text style={styles.emptyText}>No tasks yet. Create one above.</Text>
        }
        renderItem={({ item }) => (
          <LifeCard>
            <View style={styles.taskHeader}>
              <View style={{ flex: 1 }}>
                <Text
                  style={[
                    styles.taskTitle,
                    item.completed && styles.completedText,
                  ]}
                >
                  {item.title}
                </Text>

                <Text style={styles.taskMeta}>
                  {item.category ?? item.description ?? "Task"} · +
                  {item.xpValue} XP
                </Text>
              </View>

              {!item.completed && (
                <LifeButton
                  title="Complete"
                  onPress={() => completeTask(item.id)}
                />
              )}
            </View>

            <Pressable onPress={() => deleteTask(item.id)}>
              <Text style={styles.deleteText}>Delete</Text>
            </Pressable>
          </LifeCard>
        )}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },

  content: {
    padding: spacing.lg,
    paddingBottom: 120,
    gap: spacing.lg,
  },

  title: {
    color: colors.text,
    fontSize: 36,
    fontWeight: "900",
  },

  subtitle: {
    color: colors.mutedText,
    fontSize: 16,
    marginTop: -spacing.md,
  },

  cardTitle: {
    color: colors.text,
    fontSize: 20,
    fontWeight: "800",
    marginBottom: spacing.md,
  },

  label: {
    color: colors.mutedText,
    fontSize: 14,
    fontWeight: "700",
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },

  categoryContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },

  categoryChip: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.pill,
    paddingVertical: 8,
    paddingHorizontal: 14,
    backgroundColor: colors.cardLight,
  },

  selectedChip: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },

  categoryText: {
    color: colors.mutedText,
    fontWeight: "700",
  },

  selectedChipText: {
    color: colors.text,
  },

  xpPreview: {
    color: colors.accent,
    fontSize: 18,
    fontWeight: "900",
    marginVertical: spacing.md,
  },

  premadeContainer: {
    gap: spacing.sm,
  },

  premadeTask: {
    backgroundColor: colors.cardLight,
    borderRadius: radius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },

  premadeTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "800",
  },

  premadeMeta: {
    color: colors.accent,
    marginTop: 4,
    fontWeight: "700",
  },

  sectionTitle: {
    color: colors.text,
    fontSize: 24,
    fontWeight: "900",
  },

  emptyText: {
    color: colors.mutedText,
    textAlign: "center",
    marginTop: spacing.lg,
  },

  taskHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },

  taskTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: "800",
  },

  completedText: {
    textDecorationLine: "line-through",
    color: colors.mutedText,
  },

  taskMeta: {
    color: colors.accent,
    marginTop: 4,
    fontWeight: "700",
  },

  deleteText: {
    color: colors.danger,
    marginTop: spacing.md,
    fontWeight: "700",
  },
});
