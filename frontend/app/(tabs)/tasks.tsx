import { useEffect, useState } from "react";
import { Alert, Button, FlatList, Text, TextInput, View } from "react-native";
import { api } from "../../src/api/client";
import { Task } from "../../src/types";
import { useAuth } from "../../src/context/AuthContext";

export default function TasksScreen() {
  const { refreshUser, triggerDashboardRefresh } = useAuth();

  const [tasks, setTasks] = useState<Task[]>([]);
  const [title, setTitle] = useState("");
  const [xpValue, setXpValue] = useState("50");

  async function loadTasks() {
    const response = await api.get<Task[]>("/tasks");
    setTasks(response.data);
  }

  useEffect(() => {
    loadTasks();
  }, []);

  async function createTask() {
    try {
      await api.post("/tasks", {
        title,
        description: "",
        xpValue: Number(xpValue),
        dueDate: "2026-05-10",
        category: "General",
      });

      setTitle("");
      await loadTasks();
    } catch {
      Alert.alert("Could not create task");
    }
  }

  async function completeTask(id: number) {
    try {
      const response = await api.put<Task>(`/tasks/${id}/complete`);

      if (response.data.unlockedCosmetics?.length) {
        Alert.alert("New unlock!", response.data.unlockedCosmetics.join(", "));
      }

      await refreshUser();
      await loadTasks();
      triggerDashboardRefresh();
    } catch {
      Alert.alert("Could not complete task");
    }
  }

  return (
    <View style={{ flex: 1, padding: 24, gap: 12 }}>
      <Text style={{ fontSize: 28, fontWeight: "bold" }}>Tasks</Text>

      <TextInput
        placeholder="New task"
        value={title}
        onChangeText={setTitle}
        style={{ borderWidth: 1, padding: 12, borderRadius: 8 }}
      />

      <TextInput
        placeholder="XP"
        value={xpValue}
        onChangeText={setXpValue}
        keyboardType="number-pad"
        style={{ borderWidth: 1, padding: 12, borderRadius: 8 }}
      />

      <Button title="Create Task" onPress={createTask} />

      <FlatList
        data={tasks}
        keyExtractor={(item) => String(item.id)}
        renderItem={({ item }) => (
          <View style={{ padding: 16, borderWidth: 1, borderRadius: 12, marginBottom: 12 }}>
            <Text style={{ fontSize: 18, fontWeight: "bold" }}>{item.title}</Text>
            <Text>{item.xpValue} XP</Text>
            <Text>{item.completed ? "Completed" : "Incomplete"}</Text>

            {!item.completed && (
              <Button title="Complete" onPress={() => completeTask(item.id)} />
            )}
          </View>
        )}
      />
    </View>
  );
}