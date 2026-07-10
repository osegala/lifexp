package com.productivity.productivity.entity;

import jakarta.persistence.*;
import java.time.LocalDate;

@Entity
@Table(
        name = "task_completions",
        uniqueConstraints = @UniqueConstraint(columnNames = {"user_id", "task_id", "completion_date"})
)

public class TaskCompletion {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @ManyToOne
    @JoinColumn(name = "task_id", nullable = false)
    private Task task;

    @Column(name = "completion_date", nullable = false)
    private LocalDate completionDate;

    private int awardedXp;

    private TaskCategory category;

    @Enumerated(EnumType.STRING)
    private BuildingType buildingType;

    public TaskCompletion() {
    }

    public TaskCompletion(User user, Task task, LocalDate completionDate) {
        this.user = user;
        this.task = task;
        this.completionDate = completionDate;
    }

    public TaskCompletion(
            User user,
            Task task,
            LocalDate completionDate,
            int awardedXp,
            TaskCategory category,
            BuildingType buildingType
    ) {
        this(user, task, completionDate);
        this.awardedXp = awardedXp;
        this.category = category;
        this.buildingType = buildingType;
    }

    public Long getId() {
        return id;
    }

    public User getUser() {
        return user;
    }

    public void setUser(User user) {
        this.user = user;
    }

    public Task getTask() {
        return task;
    }

    public void setTask(Task task) {
        this.task = task;
    }

    public LocalDate getCompletionDate() {
        return completionDate;
    }

    public void setCompletionDate(LocalDate completionDate) {
        this.completionDate = completionDate;
    }

    public int getAwardedXp() { return awardedXp; }
    public TaskCategory getCategory() { return category; }
    public BuildingType getBuildingType() { return buildingType; }

    public void setAwardedXp(int awardedXp) { this.awardedXp = awardedXp; }
    public void setCategory(TaskCategory category) { this.category = category; }
    public void setBuildingType(BuildingType buildingType) { this.buildingType = buildingType; }
}
