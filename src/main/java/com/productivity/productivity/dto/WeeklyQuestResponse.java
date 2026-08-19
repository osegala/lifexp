package com.productivity.productivity.dto;

import com.productivity.productivity.entity.TaskCategory;
import java.time.LocalDate;

public class WeeklyQuestResponse {
    private final String key;
    private final String title;
    private final String storyText;
    private final String taskTitle;
    private final TaskCategory category;
    private final int requiredCompletions;
    private final long progress;
    private final int xpReward;
    private final int coinReward;
    private final LocalDate startsAt;
    private final LocalDate endsAt;
    private final boolean completed;
    private final boolean claimed;

    public WeeklyQuestResponse(String key, String title, String storyText, String taskTitle, TaskCategory category, int requiredCompletions, long progress, int xpReward, int coinReward, LocalDate startsAt, LocalDate endsAt, boolean completed, boolean claimed) {
        this.key = key;
        this.title = title;
        this.storyText = storyText;
        this.taskTitle = taskTitle;
        this.category = category;
        this.requiredCompletions = requiredCompletions;
        this.progress = progress;
        this.xpReward = xpReward;
        this.coinReward = coinReward;
        this.startsAt = startsAt;
        this.endsAt = endsAt;
        this.completed = completed;
        this.claimed = claimed;
    }

    public String getKey() { return key; }
    public String getTitle() { return title; }
    public String getStoryText() { return storyText; }
    public String getTaskTitle() { return taskTitle; }
    public TaskCategory getCategory() { return category; }
    public int getRequiredCompletions() { return requiredCompletions; }
    public long getProgress() { return progress; }
    public int getXpReward() { return xpReward; }
    public int getCoinReward() { return coinReward; }
    public LocalDate getStartsAt() { return startsAt; }
    public LocalDate getEndsAt() { return endsAt; }
    public boolean isCompleted() { return completed; }
    public boolean isClaimed() { return claimed; }
}
