package com.productivity.productivity.entity;

import com.fasterxml.jackson.annotation.JsonBackReference;

import jakarta.persistence.*;
import java.time.LocalDate;
import java.time.LocalTime;

import jakarta.validation.constraints.*;



@Entity
@Table(name = "tasks")
public class Task {

    
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    @NotBlank
    private String title;

    private String description;

    @Column(nullable = false)
    @Min(1)
    private int xpValue;

    private LocalDate dueDate;

    private LocalTime scheduledTime;

    @Enumerated(EnumType.STRING)
    private RepeatType repeatType = RepeatType.NONE;

    private LocalDate repeatEndsAt;

    @Column(nullable = false)
    private TaskCategory category = TaskCategory.PERSONAL_GROWTH;

    @Column(nullable = false)
    private boolean completed = false;

    @Column(nullable = false, columnDefinition = "boolean default false")
    private boolean archived = false;

    @ManyToOne
    @JoinColumn(name = "user_id", nullable = false)
        @JsonBackReference
    private User user;

    public Task() {
    }

    public Task(String title, String description, int xpValue, LocalDate dueDate, TaskCategory category, boolean completed, User user) {
        this.title = title;
        this.description = description;
        this.xpValue = xpValue;
        this.dueDate = dueDate;
        this.category = category;
        this.completed = completed;
        this.user = user;
    }

    public Long getId() {
        return id;
    }

    public String getTitle() {
        return title;
    }

    public void setTitle(String title) {
        this.title = title;
    }

    public String getDescription() {
        return description;
    }

    public void setDescription(String description) {
        this.description = description;
    }

    public int getXpValue() {
        return xpValue;
    }

    public void setXpValue(int xpValue) {
        this.xpValue = xpValue;
    }

    public LocalDate getDueDate() {
        return dueDate;
    }

    public void setDueDate(LocalDate dueDate) {
        this.dueDate = dueDate;
    }

    public LocalTime getScheduledTime() {
        return scheduledTime;
    }

    public void setScheduledTime(LocalTime scheduledTime) {
        this.scheduledTime = scheduledTime;
    }

    public RepeatType getRepeatType() {
        return repeatType == null ? RepeatType.NONE : repeatType;
    }

    public void setRepeatType(RepeatType repeatType) {
        this.repeatType = repeatType == null ? RepeatType.NONE : repeatType;
    }

    public LocalDate getRepeatEndsAt() {
        return repeatEndsAt;
    }

    public void setRepeatEndsAt(LocalDate repeatEndsAt) {
        this.repeatEndsAt = repeatEndsAt;
    }

    public TaskCategory getCategory() {
        return category == null ? TaskCategory.PERSONAL_GROWTH : category;
    }

    public void setCategory(TaskCategory category) {
        this.category = category == null ? TaskCategory.PERSONAL_GROWTH : category;
    }

    public boolean isCompleted() {
        return completed;
    }

    public void setCompleted(boolean completed) {
        this.completed = completed;
    }

    public boolean isArchived() {
        return archived;
    }

    public void setArchived(boolean archived) {
        this.archived = archived;
    }

    public User getUser() {
        return user;
    }

    public void setUser(User user) {
        this.user = user;
    }
}
