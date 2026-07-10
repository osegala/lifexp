package com.productivity.productivity.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import com.productivity.productivity.entity.RepeatType;
import com.productivity.productivity.entity.TaskCategory;
import java.time.LocalDate;

public class CreateTaskRequest {
    @NotBlank
    private String title;

    private String description;

    private LocalDate dueDate;

    private String scheduledTime;

    private RepeatType repeatType = RepeatType.NONE;

    private LocalDate repeatEndsAt;

    @NotNull
    private TaskCategory category;

    public String getTitle() { return title; }
    public String getDescription() { return description; }
    public LocalDate getDueDate() { return dueDate; }
    public String getScheduledTime() { return scheduledTime; }
    public RepeatType getRepeatType() { return repeatType; }
    public LocalDate getRepeatEndsAt() { return repeatEndsAt; }
    public TaskCategory getCategory() { return category; }

    public void setTitle(String title) { this.title = title; }
    public void setDescription(String description) { this.description = description; }
    public void setDueDate(LocalDate dueDate) { this.dueDate = dueDate; }
    public void setScheduledTime(String scheduledTime) { this.scheduledTime = scheduledTime; }
    public void setRepeatType(RepeatType repeatType) { this.repeatType = repeatType; }
    public void setRepeatEndsAt(LocalDate repeatEndsAt) { this.repeatEndsAt = repeatEndsAt; }
    public void setCategory(TaskCategory category) { this.category = category; }
}
