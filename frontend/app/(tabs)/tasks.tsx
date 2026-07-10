import { useCallback, useEffect, useState } from "react";
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
import { TaskReward } from "../../src/types/progression";

type RepeatType = "NONE" | "DAILY" | "WEEKLY";
type CalendarViewMode = "week" | "month";

type Task = {
  id: number;
  title: string;
  description?: string;
  xpValue: number;
  category?: string;
  completed: boolean;
  dueDate?: string;
  scheduledTime?: string;
  repeatType: RepeatType;
  repeatEndsAt?: string;
};

export default function TasksScreen() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [taskCountsByDate, setTaskCountsByDate] = useState<
    Record<string, number>
  >({});
  const [title, setTitle] = useState("");
  const [selectedCategory, setSelectedCategory] =
    useState<TaskCategory>("Personal Growth");
  const [selectedDate, setSelectedDate] = useState(toDateKey(new Date()));
  const [calendarView, setCalendarView] = useState<CalendarViewMode>("week");
  const [repeatType, setRepeatType] = useState<RepeatType>("NONE");
  const [scheduledTime, setScheduledTime] = useState("");
  const [repeatEndsAt, setRepeatEndsAt] = useState("");
  const [loading, setLoading] = useState(false);

  const loadTasks = useCallback(async (date: string) => {
    try {
      const response = await api.get(`/tasks?date=${date}`);
      setTasks(response.data);
    } catch (error) {
      console.log("Load tasks error:", error);
      Alert.alert("Error", "Could not load tasks.");
    }
  }, []);

  const loadTaskCounts = useCallback(async (dates: string[]) => {
    try {
      const uniqueDates = Array.from(new Set(dates));
      const results = await Promise.all(
        uniqueDates.map(async (date) => {
          const response = await api.get(`/tasks?date=${date}`);
          const remainingCount = response.data.filter(
            (task: Task) => !task.completed,
          ).length;

          return [date, remainingCount] as const;
        }),
      );

      setTaskCountsByDate(Object.fromEntries(results));
    } catch (error) {
      console.log("Load calendar task counts error:", error);
    }
  }, []);

  useEffect(() => {
    loadTasks(selectedDate);
  }, [loadTasks, selectedDate]);

  useEffect(() => {
    loadTaskCounts(
      getCalendarDays(selectedDate, calendarView).map((day) => day.date),
    );
  }, [calendarView, loadTaskCounts, selectedDate]);

  useEffect(() => {
    if (title.trim().length > 0) {
      setSelectedCategory(guessCategory(title));
    }
  }, [title]);

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

    const normalizedScheduledTime = normalizeScheduledTime(scheduledTime);

    if (scheduledTime.trim() && !normalizedScheduledTime) {
      Alert.alert(
        "Invalid time",
        "Use a time like 10:00 PM, 10 PM, or 22:00.",
      );
      return;
    }

    if (repeatType !== "NONE" && repeatEndsAt && !isDateKey(repeatEndsAt)) {
      Alert.alert("Invalid end date", "Use YYYY-MM-DD, like 2026-06-30.");
      return;
    }

    if (repeatType !== "NONE" && !repeatEndsAt) {
      Alert.alert(
        "Missing end date",
        "Choose when this repeating task should stop.",
      );
      return;
    }

    if (repeatType !== "NONE" && repeatEndsAt && repeatEndsAt < selectedDate) {
      Alert.alert(
        "Invalid end date",
        "The repeat end date must be after the start date.",
      );
      return;
    }

    try {
      setLoading(true);

      await api.post("/tasks", {
        title: finalTitle,
        description: finalCategory,
        category: finalCategory,
        dueDate: selectedDate,
        scheduledTime: normalizedScheduledTime,
        repeatType,
        repeatEndsAt: repeatType === "NONE" ? null : repeatEndsAt || null,
      });

      setTitle("");
      setScheduledTime("");
      setRepeatEndsAt("");
      setSelectedCategory("Personal Growth");
      await loadTasks(selectedDate);
      await loadTaskCounts(
        getCalendarDays(selectedDate, calendarView).map((day) => day.date),
      );
    } catch (error) {
      console.log("Create task error:", error);
      Alert.alert("Error", "Could not create task.");
    } finally {
      setLoading(false);
    }
  }

  async function completeTask(id: number) {
    try {
      const response = await api.put<TaskReward>(
        `/tasks/${id}/complete?date=${selectedDate}`,
      );
      await loadTasks(selectedDate);
      await loadTaskCounts(
        getCalendarDays(selectedDate, calendarView).map((day) => day.date),
      );
      showTaskRewards(response.data);
    } catch (error) {
      console.log("Complete task error:", error);
      Alert.alert("Error", "Could not complete task.");
    }
  }

  async function deleteTask(id: number) {
    try {
      await api.delete(`/tasks/${id}`);
      await loadTasks(selectedDate);
      await loadTaskCounts(
        getCalendarDays(selectedDate, calendarView).map((day) => day.date),
      );
    } catch (error) {
      console.log("Delete task error:", error);
      Alert.alert("Error", "Could not delete task.");
    }
  }

  const categoryXP = getXPForCategory(selectedCategory);
  const calendarDays = getCalendarDays(selectedDate, calendarView);
  const remainingTasks = tasks.filter((task) => !task.completed);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      alwaysBounceVertical={false}
      bounces={false}
      overScrollMode="never"
    >
      <Text style={styles.title}>Tasks</Text>
      <Text style={styles.subtitle}>
        Create tasks, earn XP, and build your streak.
      </Text>

      <LifeCard>
        <View style={styles.calendarHeader}>
          <Pressable
            onPress={() =>
              setSelectedDate(shiftCalendarDate(selectedDate, calendarView, -1))
            }
            style={styles.calendarNavButton}
          >
            <Text style={styles.calendarNavText}>‹</Text>
          </Pressable>

          <Text style={styles.calendarTitle}>
            {formatCalendarTitle(selectedDate)}
          </Text>

          <Pressable
            onPress={() =>
              setSelectedDate(shiftCalendarDate(selectedDate, calendarView, 1))
            }
            style={styles.calendarNavButton}
          >
            <Text style={styles.calendarNavText}>›</Text>
          </Pressable>
        </View>

        <View style={styles.viewToggle}>
          {(["week", "month"] as CalendarViewMode[]).map((mode) => (
            <Pressable
              key={mode}
              onPress={() => setCalendarView(mode)}
              style={[
                styles.viewToggleButton,
                calendarView === mode && styles.selectedViewToggleButton,
              ]}
            >
              <Text
                style={[
                  styles.viewToggleText,
                  calendarView === mode && styles.selectedViewToggleText,
                ]}
              >
                {mode}
              </Text>
            </Pressable>
          ))}
        </View>

        <View style={styles.calendarGrid}>
          {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
            <Text key={day} style={styles.weekdayLabel}>
              {day}
            </Text>
          ))}

          {calendarDays.map((day) => {
            const taskCount = taskCountsByDate[day.date] ?? 0;

            return (
              <Pressable
                key={day.date}
                onPress={() => setSelectedDate(day.date)}
                style={[
                  styles.calendarDay,
                  calendarView === "week" && styles.weekCalendarDay,
                  selectedDate === day.date && styles.selectedCalendarDay,
                  !day.isCurrentMonth && styles.outsideMonthDay,
                ]}
              >
                <Text
                  style={[
                    styles.calendarDayText,
                    !day.isCurrentMonth && styles.outsideMonthText,
                    selectedDate === day.date && styles.selectedCalendarDayText,
                  ]}
                >
                  {day.day}
                </Text>

                {taskCount > 0 && (
                  <View
                    style={[
                      styles.taskNotifier,
                      selectedDate === day.date && styles.selectedTaskNotifier,
                    ]}
                  >
                    <Text
                      style={[
                        styles.taskNotifierText,
                        selectedDate === day.date &&
                          styles.selectedTaskNotifierText,
                      ]}
                    >
                      {taskCount}
                    </Text>
                  </View>
                )}
              </Pressable>
            );
          })}
        </View>
        <Text style={styles.cardTitle}>Create New Task</Text>

        <LifeInput
          placeholder="Example: Finish homework"
          value={title}
          onChangeText={setTitle}
        />

        <Text style={styles.label}>Repeat</Text>

        <View style={styles.categoryContainer}>
          {(["NONE", "DAILY", "WEEKLY"] as RepeatType[]).map((repeat) => (
            <Pressable
              key={repeat}
              onPress={() => setRepeatType(repeat)}
              style={[
                styles.categoryChip,
                repeatType === repeat && styles.selectedChip,
              ]}
            >
              <Text
                style={[
                  styles.categoryText,
                  repeatType === repeat && styles.selectedChipText,
                ]}
              >
                {repeat}
              </Text>
            </Pressable>
          ))}
        </View>

        <Text style={styles.label}>Time</Text>

        <LifeInput
          placeholder="Optional, example: 10:00 PM"
          value={scheduledTime}
          onChangeText={setScheduledTime}
        />

        {repeatType !== "NONE" && (
          <>
            <Text style={styles.label}>Repeat Dates</Text>

            <View style={styles.repeatDatePanel}>
              <View style={styles.repeatDateRow}>
                <Text style={styles.repeatDateLabel}>Starts</Text>
                <Text style={styles.repeatDateValue}>{selectedDate}</Text>
              </View>

              <LifeInput
                placeholder="Ends on, example: 2026-06-30"
                value={repeatEndsAt}
                onChangeText={setRepeatEndsAt}
              />
            </View>
          </>
        )}

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
              <Text style={styles.premadeScheduleMeta}>
                {formatDraftSchedule(selectedDate, repeatType, repeatEndsAt)}
              </Text>
            </Pressable>
          ))}
        </View>
      </LifeCard>

      <Text style={styles.sectionTitle}>Your Tasks</Text>

      <FlatList
        data={remainingTasks}
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

                <Text style={styles.scheduleMeta}>
                  {formatTaskSchedule(item)}
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

function showTaskRewards(reward: TaskReward) {
  const messages: string[] = [];

  if (reward.buildingProgress) {
    messages.push(
      `${reward.buildingProgress.type} gained progress and is now level ${reward.buildingProgress.level}.`,
    );
  }

  if (reward.leveledUp) {
    messages.push("Your hero leveled up.");
  }

  if (reward.unlockedCosmetics?.length) {
    messages.push(`Unlocked: ${reward.unlockedCosmetics.join(", ")}.`);
  }

  if (messages.length > 0) {
    Alert.alert("Progress Earned", messages.join("\n\n"));
  }
}

function toDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function getCalendarDays(selectedDate: string, viewMode: CalendarViewMode) {
  return viewMode === "week"
    ? getWeekDays(selectedDate)
    : getMonthDays(selectedDate);
}

function getWeekDays(selectedDate: string) {
  const selected = new Date(`${selectedDate}T00:00:00`);
  const start = new Date(selected);
  start.setDate(selected.getDate() - selected.getDay());

  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(start);
    date.setDate(start.getDate() + index);

    return {
      date: toDateKey(date),
      day: date.getDate(),
      isCurrentMonth: true,
    };
  });
}

function getMonthDays(selectedDate: string) {
  const selected = new Date(`${selectedDate}T00:00:00`);
  const year = selected.getFullYear();
  const month = selected.getMonth();

  const firstOfMonth = new Date(year, month, 1);
  const start = new Date(firstOfMonth);
  start.setDate(firstOfMonth.getDate() - firstOfMonth.getDay());

  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(start);
    date.setDate(start.getDate() + index);

    return {
      date: toDateKey(date),
      day: date.getDate(),
      isCurrentMonth: date.getMonth() === month,
    };
  });
}

function shiftCalendarDate(
  selectedDate: string,
  viewMode: CalendarViewMode,
  direction: -1 | 1,
) {
  const date = new Date(`${selectedDate}T00:00:00`);

  if (viewMode === "week") {
    date.setDate(date.getDate() + direction * 7);
  } else {
    date.setMonth(date.getMonth() + direction);
  }

  return toDateKey(date);
}

function formatCalendarTitle(selectedDate: string) {
  return new Date(`${selectedDate}T00:00:00`).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });
}

function normalizeScheduledTime(value: string) {
  const trimmedValue = value.trim();

  if (!trimmedValue) {
    return null;
  }

  const twentyFourHourMatch = trimmedValue.match(/^(\d{1,2}):(\d{2})$/);

  if (twentyFourHourMatch) {
    const hour = Number(twentyFourHourMatch[1]);
    const minute = Number(twentyFourHourMatch[2]);

    if (hour < 24 && minute < 60) {
      return `${String(hour).padStart(2, "0")}:${String(minute).padStart(
        2,
        "0",
      )}`;
    }
  }

  const meridiemMatch = trimmedValue.match(
    /^(\d{1,2})(?::(\d{2}))?\s*(am|pm)$/i,
  );

  if (meridiemMatch) {
    let hour = Number(meridiemMatch[1]);
    const minute = Number(meridiemMatch[2] ?? "0");
    const meridiem = meridiemMatch[3].toLowerCase();

    if (hour >= 1 && hour <= 12 && minute < 60) {
      if (meridiem === "pm" && hour !== 12) {
        hour += 12;
      }

      if (meridiem === "am" && hour === 12) {
        hour = 0;
      }

      return `${String(hour).padStart(2, "0")}:${String(minute).padStart(
        2,
        "0",
      )}`;
    }
  }

  return null;
}

function isDateKey(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  return toDateKey(new Date(`${value}T00:00:00`)) === value;
}

function formatDraftSchedule(
  selectedDate: string,
  repeatType: RepeatType,
  repeatEndsAt: string,
) {
  if (repeatType === "NONE") {
    return selectedDate;
  }

  return repeatEndsAt
    ? `${repeatType.toLowerCase()} from ${selectedDate} to ${repeatEndsAt}`
    : `${repeatType.toLowerCase()} from ${selectedDate}`;
}

function formatTaskSchedule(task: Task) {
  const details = [];

  if (task.dueDate) {
    details.push(task.dueDate);
  }

  if (task.scheduledTime) {
    details.push(task.scheduledTime.slice(0, 5));
  }

  if (task.repeatType && task.repeatType !== "NONE") {
    details.push(task.repeatType.toLowerCase());
  }

  return details.length > 0 ? details.join(" · ") : "Unscheduled";
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

  calendarHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: spacing.md,
  },

  calendarNavButton: {
    width: 40,
    height: 40,
    borderRadius: radius.pill,
    backgroundColor: colors.cardLight,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },

  calendarNavText: {
    color: colors.text,
    fontSize: 28,
    fontWeight: "900",
    lineHeight: 30,
  },

  calendarTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: "900",
  },

  viewToggle: {
    flexDirection: "row",
    backgroundColor: colors.cardLight,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 4,
    marginBottom: spacing.lg,
  },

  viewToggleButton: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.pill,
    paddingVertical: 9,
  },

  selectedViewToggleButton: {
    backgroundColor: colors.primary,
  },

  viewToggleText: {
    color: colors.mutedText,
    fontWeight: "800",
    textTransform: "capitalize",
  },

  selectedViewToggleText: {
    color: colors.text,
  },

  calendarGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginBottom: spacing.lg,
  },

  weekdayLabel: {
    width: "14.285%",
    color: colors.mutedText,
    fontSize: 12,
    fontWeight: "900",
    textAlign: "center",
    marginBottom: spacing.sm,
  },

  calendarDay: {
    width: "14.285%",
    aspectRatio: 1,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.md,
    position: "relative",
  },

  weekCalendarDay: {
    minHeight: 62,
  },

  selectedCalendarDay: {
    backgroundColor: colors.primary,
  },

  outsideMonthDay: {
    opacity: 0.55,
  },

  calendarDayText: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "900",
  },

  outsideMonthText: {
    color: colors.mutedText,
  },

  selectedCalendarDayText: {
    color: colors.text,
  },

  taskNotifier: {
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: colors.accent,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 5,
    marginTop: 4,
  },

  selectedTaskNotifier: {
    backgroundColor: colors.text,
  },

  taskNotifierText: {
    color: colors.background,
    fontSize: 10,
    fontWeight: "900",
  },

  selectedTaskNotifierText: {
    color: colors.primary,
  },

  repeatDatePanel: {
    gap: spacing.sm,
  },

  repeatDateRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: colors.cardLight,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
  },

  repeatDateLabel: {
    color: colors.mutedText,
    fontWeight: "800",
  },

  repeatDateValue: {
    color: colors.text,
    fontWeight: "900",
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

  premadeScheduleMeta: {
    color: colors.mutedText,
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

  scheduleMeta: {
    color: colors.mutedText,
    marginTop: 4,
    fontWeight: "700",
  },

  deleteText: {
    color: colors.danger,
    marginTop: spacing.md,
    fontWeight: "700",
  },
});
