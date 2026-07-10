package com.productivity.productivity.dto;

import com.productivity.productivity.entity.RepeatType;
import com.productivity.productivity.entity.TaskCategory;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.List;

public class TaskResponse {
    private Long id;
    private String title;
    private String description;
    private int xpValue;
    private LocalDate dueDate;
    private LocalTime scheduledTime;
    private RepeatType repeatType;
    private LocalDate repeatEndsAt;
    private TaskCategory category;
    private boolean completed;
    private List<String> unlockedCosmetics;
    private BuildingProgressResponse buildingProgress;
    private boolean leveledUp;

    public TaskResponse(Long id, String title, String description, int xpValue, LocalDate dueDate, TaskCategory category, boolean completed) {
        this.id = id;
        this.title = title;
        this.description = description;
        this.xpValue = xpValue;
        this.dueDate = dueDate;
        this.category = category;
        this.completed = completed;
    }

    public TaskResponse(Long id, String title, String description, int xpValue, LocalDate dueDate, LocalTime scheduledTime, RepeatType repeatType, LocalDate repeatEndsAt, TaskCategory category, boolean completed) {
        this(id, title, description, xpValue, dueDate, category, completed);
        this.scheduledTime = scheduledTime;
        this.repeatType = repeatType;
        this.repeatEndsAt = repeatEndsAt;
    }

    public void setUnlockedCosmetics(List<String> unlockedCosmetics) {
        this.unlockedCosmetics = unlockedCosmetics;
    }

    public void setBuildingProgress(BuildingProgressResponse buildingProgress) {
        this.buildingProgress = buildingProgress;
    }

    public void setLeveledUp(boolean leveledUp) {
        this.leveledUp = leveledUp;
    }

    public Long getId() { return id; }
    public String getTitle() { return title; }
    public String getDescription() { return description; }
    public int getXpValue() { return xpValue; }
    public LocalDate getDueDate() { return dueDate; }
    public LocalTime getScheduledTime() { return scheduledTime; }
    public RepeatType getRepeatType() { return repeatType; }
    public LocalDate getRepeatEndsAt() { return repeatEndsAt; }
    public TaskCategory getCategory() { return category; }
    public boolean isCompleted() { return completed; }
    public List<String> getUnlockedCosmetics() { return unlockedCosmetics; }    
    public BuildingProgressResponse getBuildingProgress() { return buildingProgress; }
    public boolean isLeveledUp() { return leveledUp; }
}
