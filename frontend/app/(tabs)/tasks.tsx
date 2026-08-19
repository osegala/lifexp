import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { router } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { api } from "../../src/api/client";
import { useAuth } from "../../src/context/AuthContext";
import LifeButton from "../../src/components/LifeButton";
import LifeCard from "../../src/components/LifeCard";
import LifeInput from "../../src/components/LifeInput";
import { colors, radius, spacing } from "../../src/theme/theme";
import { TaskReward } from "../../src/types/progression";
import {
  PREMADE_TASKS,
  TASK_CATEGORIES,
  TASK_CATEGORY_REWARDS,
  TaskCategory,
  getXPForCategory,
  guessCategory,
} from "../../src/utils/taskCategories";

type RepeatType = "NONE" | "DAILY" | "WEEKLY";
type CalendarViewMode = "week" | "month";
type IconName = React.ComponentProps<typeof MaterialCommunityIcons>["name"];
type FieldErrors = Partial<
  Record<"title" | "scheduledTime" | "repeatEndsAt", string>
>;
type RewardNotice = {
  message: string;
  buildingChanged: boolean;
  cosmeticsUnlocked: boolean;
};

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

const REPEAT_OPTIONS: { value: RepeatType; label: string }[] = [
  { value: "NONE", label: "Does not repeat" },
  { value: "DAILY", label: "Daily" },
  { value: "WEEKLY", label: "Weekly" },
];

const QUICK_TIMES = [
  { label: "No time", value: "" },
  { label: "Morning", value: "09:00" },
  { label: "Afternoon", value: "14:00" },
  { label: "Evening", value: "18:00" },
];

const REPEAT_END_OPTIONS = [
  { label: "1 week", days: 7 },
  { label: "1 month", days: 30 },
  { label: "3 months", days: 90 },
];

export default function TasksScreen() {
  const { triggerDashboardRefresh } = useAuth();
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
  const [tasksLoading, setTasksLoading] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [rewardNotice, setRewardNotice] = useState<RewardNotice | null>(null);
  const [completingTaskId, setCompletingTaskId] = useState<number | null>(null);
  const [deletingTaskId, setDeletingTaskId] = useState<number | null>(null);

  const loadTasks = useCallback(async (date: string) => {
    try {
      setTasksLoading(true);
      const response = await api.get(`/tasks?date=${date}`);
      setTasks(response.data);
    } catch (error) {
      console.log("Load tasks error:", error);
      Alert.alert("Error", "Could not load tasks.");
    } finally {
      setTasksLoading(false);
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
    useCurrentSchedule = true,
  ) {
    const finalTitle = customTitle ?? title;
    const finalCategory = customCategory ?? selectedCategory;
    const finalRepeatType = useCurrentSchedule ? repeatType : "NONE";
    const finalScheduledTime = useCurrentSchedule ? scheduledTime : "";
    const finalRepeatEndsAt = useCurrentSchedule ? repeatEndsAt : "";
    const errors: FieldErrors = {};

    if (!finalTitle.trim()) {
      errors.title = "Name the quest before adding it.";
    }

    const normalizedScheduledTime = normalizeScheduledTime(finalScheduledTime);

    if (finalScheduledTime.trim() && !normalizedScheduledTime) {
      errors.scheduledTime = "Use 10:00 PM, 10 PM, or 22:00.";
    }

    if (
      finalRepeatType !== "NONE" &&
      finalRepeatEndsAt &&
      !isDateKey(finalRepeatEndsAt)
    ) {
      errors.repeatEndsAt = "Use YYYY-MM-DD, like 2026-06-30.";
    }

    if (finalRepeatType !== "NONE" && !finalRepeatEndsAt) {
      errors.repeatEndsAt = "Choose when this repeating quest should stop.";
    }

    if (
      finalRepeatType !== "NONE" &&
      finalRepeatEndsAt &&
      finalRepeatEndsAt < selectedDate
    ) {
      errors.repeatEndsAt = "The repeat end date must be after the start date.";
    }

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      setShowCreateForm(true);
      return;
    }

    try {
      setLoading(true);
      setFieldErrors({});

      const response = await api.post<Task>("/tasks", {
        title: finalTitle,
        description: finalCategory,
        category: finalCategory,
        dueDate: selectedDate,
        scheduledTime: normalizedScheduledTime,
        repeatType: finalRepeatType,
        repeatEndsAt:
          finalRepeatType === "NONE" ? null : finalRepeatEndsAt || null,
      });

      if (!response.data.completed) {
        setTasks((current) => [
          response.data,
          ...current.filter((task) => task.id !== response.data.id),
        ]);
      }

      setTitle("");
      setScheduledTime("");
      setRepeatEndsAt("");
      setRepeatType("NONE");
      setSelectedCategory("Personal Growth");
      setShowCreateForm(false);
      setRewardNotice({
        message: `${finalTitle.trim()} added to ${formatShortDate(selectedDate)}.`,
        buildingChanged: false,
        cosmeticsUnlocked: false,
      });
      await loadTasks(selectedDate);
      triggerDashboardRefresh();
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

  async function completeTask(task: Task) {
    try {
      setCompletingTaskId(task.id);
      const response = await api.put<TaskReward>(
        `/tasks/${task.id}/complete?date=${selectedDate}`,
      );
      await loadTasks(selectedDate);
      triggerDashboardRefresh();
      await loadTaskCounts(
        getCalendarDays(selectedDate, calendarView).map((day) => day.date),
      );
      setRewardNotice(formatTaskRewards(response.data, task));
    } catch (error) {
      console.log("Complete task error:", error);
      Alert.alert("Error", "Could not complete task.");
    } finally {
      setCompletingTaskId(null);
    }
  }

  function deleteTask(task: Task) {
    const isRepeating = task.repeatType !== "NONE";

    if (Platform.OS === "web") {
      const confirmed = window.confirm(
        isRepeating
          ? "Delete this repeating quest from future dates too?"
          : "Delete this quest?",
      );

      if (confirmed) {
        void performDeleteTask(task.id);
      }
      return;
    }

    Alert.alert(
      isRepeating ? "Delete repeating quest?" : "Delete quest?",
      isRepeating
        ? "This removes the repeating quest from future dates too."
        : "You can add it again later if you need it.",
      [
        { text: "Keep", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => {
            void performDeleteTask(task.id);
          },
        },
      ],
    );
  }

  async function performDeleteTask(id: number) {
    try {
      setDeletingTaskId(id);
      await api.delete(`/tasks/${id}`);
      await loadTasks(selectedDate);
      await loadTaskCounts(
        getCalendarDays(selectedDate, calendarView).map((day) => day.date),
      );
      setRewardNotice({
        message: "Quest deleted.",
        buildingChanged: false,
        cosmeticsUnlocked: false,
      });
    } catch (error) {
      console.log("Delete task error:", error);
      Alert.alert("Error", "Could not delete task.");
    } finally {
      setDeletingTaskId(null);
    }
  }

  const categoryXP = getXPForCategory(selectedCategory);
  const calendarDays = getCalendarDays(selectedDate, calendarView);
  const completedTasks = tasks.filter((task) => task.completed).length;
  const remainingTasks = tasks.length - completedTasks;
  const selectedCategoryReward = TASK_CATEGORY_REWARDS[selectedCategory];

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      alwaysBounceVertical={false}
      bounces={false}
      overScrollMode="never"
    >
      <View style={styles.headerRow}>
        <View style={styles.headerActions}>
          {selectedDate !== toDateKey(new Date()) && (
            <Pressable
              onPress={() => setSelectedDate(toDateKey(new Date()))}
              style={styles.todayButton}
            >
              <Text style={styles.todayButtonText}>Today</Text>
            </Pressable>
          )}

          <Pressable
            onPress={() => setShowCreateForm((current) => !current)}
            style={styles.addButton}
          >
            <MaterialCommunityIcons
              name={showCreateForm ? "close" : "plus"}
              color={colors.text}
              size={24}
            />
          </Pressable>
        </View>
      </View>

      {showCreateForm && (
        <LifeCard compact style={styles.addQuestCard}>
          <Text style={styles.cardTitle}>Add Quest</Text>
          <Text style={styles.formSectionTitle}>1. Name the quest</Text>

          <LifeInput
            placeholder="Example: Finish homework"
            value={title}
            onChangeText={(value) => {
              setTitle(value);
              setFieldErrors((current) => ({ ...current, title: undefined }));
            }}
          />
          {fieldErrors.title && (
            <Text style={styles.errorText}>{fieldErrors.title}</Text>
          )}

          <Text style={styles.formSectionTitle}>2. Schedule it</Text>

          <Text style={styles.label}>Repeat</Text>
          <View style={styles.categoryContainer}>
            {REPEAT_OPTIONS.map((repeat) => (
              <Pressable
                key={repeat.value}
                onPress={() => setRepeatType(repeat.value)}
                style={[
                  styles.categoryChip,
                  repeatType === repeat.value && styles.selectedChip,
                ]}
              >
                <Text
                  style={[
                    styles.categoryText,
                    repeatType === repeat.value && styles.selectedChipText,
                  ]}
                >
                  {repeat.label}
                </Text>
              </Pressable>
            ))}
          </View>

          <Text style={styles.label}>Time</Text>
          <View style={styles.categoryContainer}>
            {QUICK_TIMES.map((time) => (
              <Pressable
                key={time.label}
                onPress={() => {
                  setScheduledTime(time.value);
                  setFieldErrors((current) => ({
                    ...current,
                    scheduledTime: undefined,
                  }));
                }}
                style={[
                  styles.categoryChip,
                  scheduledTime === time.value && styles.selectedChip,
                ]}
              >
                <Text
                  style={[
                    styles.categoryText,
                    scheduledTime === time.value && styles.selectedChipText,
                  ]}
                >
                  {time.label}
                </Text>
              </Pressable>
            ))}
          </View>

          <LifeInput
            placeholder="Custom time, example: 10:00 PM"
            value={scheduledTime}
            onChangeText={(value) => {
              setScheduledTime(value);
              setFieldErrors((current) => ({
                ...current,
                scheduledTime: undefined,
              }));
            }}
          />
          {fieldErrors.scheduledTime && (
            <Text style={styles.errorText}>{fieldErrors.scheduledTime}</Text>
          )}

          {repeatType !== "NONE" && (
            <>
              <Text style={styles.label}>Repeat Window</Text>

              <View style={styles.repeatDatePanel}>
                <View style={styles.repeatDateRow}>
                  <Text style={styles.repeatDateLabel}>Starts</Text>
                  <Text style={styles.repeatDateValue}>
                    {formatShortDate(selectedDate)}
                  </Text>
                </View>

                <View style={styles.categoryContainer}>
                  {REPEAT_END_OPTIONS.map((option) => {
                    const optionDate = shiftDateByDays(selectedDate, option.days);

                    return (
                      <Pressable
                        key={option.label}
                        onPress={() => {
                          setRepeatEndsAt(optionDate);
                          setFieldErrors((current) => ({
                            ...current,
                            repeatEndsAt: undefined,
                          }));
                        }}
                        style={[
                          styles.categoryChip,
                          repeatEndsAt === optionDate && styles.selectedChip,
                        ]}
                      >
                        <Text
                          style={[
                            styles.categoryText,
                            repeatEndsAt === optionDate &&
                              styles.selectedChipText,
                          ]}
                        >
                          {option.label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>

                <LifeInput
                  placeholder="Custom end date, example: 2026-06-30"
                  value={repeatEndsAt}
                  onChangeText={(value) => {
                    setRepeatEndsAt(value);
                    setFieldErrors((current) => ({
                      ...current,
                      repeatEndsAt: undefined,
                    }));
                  }}
                />
                {fieldErrors.repeatEndsAt && (
                  <Text style={styles.errorText}>
                    {fieldErrors.repeatEndsAt}
                  </Text>
                )}
              </View>
            </>
          )}

          <Text style={styles.formSectionTitle}>3. Pick the reward lane</Text>
          <Text style={styles.label}>Suggested Category</Text>
          <View style={styles.rewardGrid}>
            {Object.keys(TASK_CATEGORIES).map((category) => (
              <CategoryRewardChip
                key={category}
                category={category as TaskCategory}
                selected={selectedCategory === category}
                onPress={() => setSelectedCategory(category as TaskCategory)}
              />
            ))}
          </View>

          <View style={styles.xpPreview}>
            <MaterialCommunityIcons
              name={selectedCategoryReward.icon as IconName}
              color={colors.accent}
              size={22}
            />
            <View style={styles.xpPreviewText}>
              <Text style={styles.xpPreviewTitle}>+{categoryXP} XP</Text>
              <Text style={styles.xpPreviewMeta}>
                Upgrades {selectedCategoryReward.building}
              </Text>
            </View>
          </View>

          <LifeButton
            title={loading ? "Adding..." : "Add Quest"}
            onPress={() => createTask()}
            disabled={loading}
          />
        </LifeCard>
      )}

      <LifeCard compact style={styles.calendarCard}>
        <View style={styles.calendarHeader}>
          <Pressable
            onPress={() =>
              setSelectedDate(shiftCalendarDate(selectedDate, calendarView, -1))
            }
            style={styles.calendarNavButton}
          >
            <MaterialCommunityIcons
              name="chevron-left"
              color={colors.text}
              size={24}
            />
          </Pressable>

          <View style={styles.calendarHeading}>
            <Text style={styles.calendarTitle}>
              {formatCalendarTitle(selectedDate)}
            </Text>
            <Text style={styles.calendarSubtitle}>
              {formatShortDate(selectedDate)} - {remainingTasks} open
            </Text>
          </View>

          <Pressable
            onPress={() =>
              setSelectedDate(shiftCalendarDate(selectedDate, calendarView, 1))
            }
            style={styles.calendarNavButton}
          >
            <MaterialCommunityIcons
              name="chevron-right"
              color={colors.text}
              size={24}
            />
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
      </LifeCard>

      {rewardNotice && (
        <View style={styles.rewardNotice}>
          <MaterialCommunityIcons
            name="progress-star"
            color={colors.accent}
            size={22}
          />
          <View style={styles.rewardNoticeBody}>
            <Text style={styles.rewardNoticeText}>{rewardNotice.message}</Text>
            {(rewardNotice.buildingChanged || rewardNotice.cosmeticsUnlocked) && (
              <View style={styles.rewardNoticeActions}>
                {rewardNotice.buildingChanged && (
                  <Pressable
                    onPress={() => router.push("/(tabs)/base")}
                    style={styles.rewardNoticeButton}
                  >
                    <Text style={styles.rewardNoticeButtonText}>View Base</Text>
                  </Pressable>
                )}
                {rewardNotice.cosmeticsUnlocked && (
                  <Pressable
                    onPress={() => router.push("/(tabs)/avatar")}
                    style={styles.rewardNoticeButton}
                  >
                    <Text style={styles.rewardNoticeButtonText}>View Avatar</Text>
                  </Pressable>
                )}
              </View>
            )}
          </View>
          <Pressable
            onPress={() => setRewardNotice(null)}
            style={styles.noticeCloseButton}
          >
            <MaterialCommunityIcons
              name="close"
              color={colors.mutedText}
              size={18}
            />
          </Pressable>
        </View>
      )}

      <View style={styles.sectionHeader}>
        <View>
          <Text style={styles.sectionTitle}>
            Quests for {formatShortDate(selectedDate)}
          </Text>
          <Text style={styles.sectionSubtitle}>
            {completedTasks} done - {remainingTasks} open
          </Text>
        </View>

        {tasksLoading && <ActivityIndicator color={colors.primary} />}
      </View>

      <FlatList
        data={tasks}
        keyExtractor={(item) => String(item.id)}
        scrollEnabled={false}
        contentContainerStyle={styles.taskList}
        ListEmptyComponent={
          <LifeCard style={styles.emptyCard}>
            <MaterialCommunityIcons
              name="clipboard-check-outline"
              color={colors.accent}
              size={34}
            />
            <Text style={styles.emptyTitle}>No quests planned.</Text>
            <Text style={styles.emptyText}>
              Add one task or pick a quick quest to start earning XP.
            </Text>
          </LifeCard>
        }
        renderItem={({ item }) => (
          <QuestCard
            task={item}
            completing={completingTaskId === item.id}
            deleting={deletingTaskId === item.id}
            onComplete={() => completeTask(item)}
            onDelete={() => deleteTask(item)}
          />
        )}
      />

      <LifeCard compact>
        <Text style={styles.cardTitle}>Quick Quests</Text>

        <View style={styles.premadeContainer}>
          {PREMADE_TASKS.map((task) => {
            const reward = TASK_CATEGORY_REWARDS[task.category];

            return (
              <Pressable
                key={task.title}
                style={styles.premadeTask}
                onPress={() => createTask(task.title, task.category, false)}
              >
                <View style={styles.premadeIcon}>
                  <MaterialCommunityIcons
                    name={reward.icon as IconName}
                    color={colors.accent}
                    size={20}
                  />
                </View>

                <View style={styles.premadeInfo}>
                  <Text style={styles.premadeTitle}>{task.title}</Text>
                  <Text style={styles.premadeMeta}>
                    {task.category} - +{getXPForCategory(task.category)} XP
                  </Text>
                  <Text style={styles.premadeScheduleMeta}>
                    Adds to {formatShortDate(selectedDate)} without repeat
                    settings
                  </Text>
                </View>
              </Pressable>
            );
          })}
        </View>
      </LifeCard>
    </ScrollView>
  );
}

function CategoryRewardChip({
  category,
  selected,
  onPress,
}: {
  category: TaskCategory;
  selected: boolean;
  onPress: () => void;
}) {
  const reward = TASK_CATEGORY_REWARDS[category];

  return (
    <Pressable
      onPress={onPress}
      style={[styles.rewardChip, selected && styles.selectedRewardChip]}
    >
      <MaterialCommunityIcons
        name={reward.icon as IconName}
        color={selected ? colors.text : colors.accent}
        size={20}
      />
      <View style={styles.rewardChipText}>
        <Text
          style={[styles.rewardChipTitle, selected && styles.selectedChipText]}
        >
          {category}
        </Text>
        <Text
          style={[styles.rewardChipMeta, selected && styles.selectedChipText]}
        >
          +{getXPForCategory(category)} XP - {reward.building}
        </Text>
      </View>
    </Pressable>
  );
}

function QuestCard({
  task,
  completing,
  deleting,
  onComplete,
  onDelete,
}: {
  task: Task;
  completing: boolean;
  deleting: boolean;
  onComplete: () => void;
  onDelete: () => void;
}) {
  const category = normalizeCategory(task.category ?? task.description);
  const reward = category ? TASK_CATEGORY_REWARDS[category] : null;

  return (
    <LifeCard compact style={[styles.questCard, task.completed && styles.completedCard]}>
      <View style={styles.taskHeader}>
        <View style={styles.questStatus}>
          <MaterialCommunityIcons
            name={task.completed ? "check-circle" : "circle-outline"}
            color={task.completed ? colors.accent : colors.mutedText}
            size={26}
          />
        </View>

        <View style={styles.taskInfo}>
          <Text style={[styles.taskTitle, task.completed && styles.completedText]}>
            {task.title}
          </Text>

          <Text style={styles.taskMeta}>
            {category ?? "Quest"} - +{task.xpValue} XP
            {reward ? ` - ${reward.building}` : ""}
          </Text>

          <Text style={styles.scheduleMeta}>{formatTaskSchedule(task)}</Text>
        </View>
      </View>

      <View style={styles.taskActionRow}>
        {!task.completed && (
          <LifeButton
            title={completing ? "..." : "Done"}
            onPress={onComplete}
            disabled={completing || deleting}
          />
        )}

        <Pressable
          onPress={onDelete}
          disabled={deleting}
          style={styles.deleteButton}
        >
          <MaterialCommunityIcons
            name="trash-can-outline"
            color={colors.danger}
            size={18}
          />
          <Text style={styles.deleteText}>{deleting ? "Deleting..." : "Delete"}</Text>
        </Pressable>
      </View>
    </LifeCard>
  );
}

function formatTaskRewards(reward: TaskReward, task: Task): RewardNotice {
  const messages = [`${task.title} complete. +${task.xpValue} XP earned.`];

  if (reward.buildingProgress) {
    messages.push(
      `${reward.buildingProgress.type} reached level ${reward.buildingProgress.level}.`,
    );
  }

  if (reward.leveledUp) {
    messages.push("Your hero leveled up.");
  }

  if (reward.unlockedCosmetics?.length) {
    messages.push(`Unlocked: ${reward.unlockedCosmetics.join(", ")}.`);
  }

  return {
    message: messages.join(" "),
    buildingChanged: Boolean(reward.buildingProgress),
    cosmeticsUnlocked: Boolean(reward.unlockedCosmetics?.length),
  };
}

function normalizeCategory(value?: string): TaskCategory | null {
  if (!value) {
    return null;
  }

  return Object.keys(TASK_CATEGORIES).includes(value)
    ? (value as TaskCategory)
    : null;
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

function shiftDateByDays(dateKey: string, days: number) {
  const date = new Date(`${dateKey}T00:00:00`);
  date.setDate(date.getDate() + days);
  return toDateKey(date);
}

function formatCalendarTitle(selectedDate: string) {
  return new Date(`${selectedDate}T00:00:00`).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });
}

function formatShortDate(dateKey: string) {
  return new Date(`${dateKey}T00:00:00`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
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

function formatTaskSchedule(task: Task) {
  const details = [];

  if (task.dueDate) {
    details.push(formatShortDate(task.dueDate));
  }

  if (task.scheduledTime) {
    details.push(task.scheduledTime.slice(0, 5));
  }

  if (task.repeatType && task.repeatType !== "NONE") {
    details.push(task.repeatType.toLowerCase());
  }

  return details.length > 0 ? details.join(" - ") : "Unscheduled";
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

  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md,
  },

  headerText: {
    flex: 1,
  },

  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    flexWrap: "wrap",
    gap: spacing.sm,
  },

  todayButton: {
    backgroundColor: colors.cardLight,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },

  todayButtonText: {
    color: colors.text,
    fontWeight: "600",
  },

  title: {
    color: colors.text,
    fontSize: 30,
    fontWeight: "700",
  },

  subtitle: {
    color: colors.mutedText,
    fontSize: 16,
    marginTop: 2,
    lineHeight: 22,
  },

  addButton: {
    width: 48,
    height: 48,
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },

  calendarCard: {
    gap: spacing.md,
  },

  calendarHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    flexWrap: "wrap",
    gap: spacing.md,
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

  calendarHeading: {
    flex: 1,
    minWidth: 150,
    alignItems: "center",
  },

  calendarTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: "700",
  },

  calendarSubtitle: {
    color: colors.mutedText,
    fontSize: 13,
    fontWeight: "500",
    marginTop: 2,
  },

  viewToggle: {
    flexDirection: "row",
    backgroundColor: colors.cardLight,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 4,
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
    fontWeight: "600",
    textTransform: "capitalize",
  },

  selectedViewToggleText: {
    color: colors.text,
  },

  calendarGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
  },

  weekdayLabel: {
    width: "14.285%",
    color: colors.mutedText,
    fontSize: 12,
    fontWeight: "600",
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
    fontWeight: "600",
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
    backgroundColor: colors.primaryDark,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 5,
    marginTop: 4,
  },

  selectedTaskNotifier: {
    backgroundColor: colors.text,
  },

  taskNotifierText: {
    color: colors.text,
    fontSize: 10,
    fontWeight: "600",
  },

  selectedTaskNotifierText: {
    color: colors.primary,
  },

  rewardNotice: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    backgroundColor: colors.cardLight,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
  },

  rewardNoticeText: {
    color: colors.text,
    fontWeight: "500",
    lineHeight: 20,
  },

  rewardNoticeBody: {
    flex: 1,
    gap: spacing.sm,
  },

  rewardNoticeActions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },

  rewardNoticeButton: {
    backgroundColor: colors.card,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },

  rewardNoticeButtonText: {
    color: colors.text,
    fontWeight: "600",
  },

  noticeCloseButton: {
    width: 44,
    height: 44,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
  },

  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md,
  },

  sectionTitle: {
    color: colors.text,
    fontSize: 20,
    fontWeight: "700",
  },

  sectionSubtitle: {
    color: colors.mutedText,
    fontSize: 14,
    fontWeight: "500",
    marginTop: 2,
  },

  taskList: {
    gap: spacing.md,
  },

  emptyCard: {
    alignItems: "center",
    gap: spacing.sm,
  },

  emptyTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: "700",
  },

  emptyText: {
    color: colors.mutedText,
    textAlign: "center",
    lineHeight: 20,
  },

  cardTitle: {
    color: colors.text,
    fontSize: 20,
    fontWeight: "700",
    marginBottom: spacing.md,
  },

  addQuestCard: {
    gap: spacing.xs,
  },

  formSectionTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "700",
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },

  label: {
    color: colors.mutedText,
    fontSize: 14,
    fontWeight: "500",
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },

  errorText: {
    color: colors.danger,
    fontWeight: "600",
    marginTop: spacing.xs,
  },

  categoryContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
    marginBottom: spacing.sm,
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
    fontWeight: "500",
  },

  selectedChipText: {
    color: colors.text,
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
    fontWeight: "600",
  },

  repeatDateValue: {
    color: colors.text,
    fontWeight: "600",
  },

  rewardGrid: {
    gap: spacing.sm,
  },

  rewardChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
    backgroundColor: colors.cardLight,
  },

  selectedRewardChip: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },

  rewardChipText: {
    flex: 1,
  },

  rewardChipTitle: {
    color: colors.text,
    fontWeight: "700",
  },

  rewardChipMeta: {
    color: colors.mutedText,
    fontSize: 12,
    fontWeight: "700",
    marginTop: 2,
  },

  xpPreview: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    backgroundColor: colors.cardLight,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
    marginVertical: spacing.md,
  },

  xpPreviewText: {
    flex: 1,
  },

  xpPreviewTitle: {
    color: colors.accent,
    fontSize: 18,
    fontWeight: "700",
  },

  xpPreviewMeta: {
    color: colors.mutedText,
    fontWeight: "500",
    marginTop: 2,
  },

  premadeContainer: {
    gap: spacing.sm,
  },

  premadeTask: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    backgroundColor: colors.cardLight,
    borderRadius: radius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },

  premadeIcon: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    backgroundColor: colors.card,
    alignItems: "center",
    justifyContent: "center",
  },

  premadeInfo: {
    flex: 1,
  },

  premadeTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "600",
  },

  premadeMeta: {
    color: colors.accent,
    marginTop: 4,
    fontWeight: "600",
  },

  premadeScheduleMeta: {
    color: colors.mutedText,
    marginTop: 4,
    fontSize: 12,
    fontWeight: "500",
  },

  questCard: {
    gap: spacing.md,
  },

  completedCard: {
    opacity: 0.72,
  },

  taskHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.md,
  },

  questStatus: {
    width: 32,
    alignItems: "center",
  },

  taskInfo: {
    flex: 1,
    minWidth: 0,
  },

  taskTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: "700",
  },

  completedText: {
    textDecorationLine: "line-through",
    color: colors.mutedText,
  },

  taskMeta: {
    color: colors.accent,
    marginTop: 4,
    fontWeight: "600",
  },

  scheduleMeta: {
    color: colors.mutedText,
    marginTop: 4,
    fontWeight: "500",
  },

  deleteButton: {
    minHeight: 44,
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
  },

  taskActionRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: spacing.sm,
    paddingLeft: 32 + spacing.md,
  },

  deleteText: {
    color: colors.danger,
    fontWeight: "600",
  },
});
