package com.productivity.productivity.dto;

import java.util.List;

public class UserResponse {
    private Long id;
    private String username;
    private String email;
    private int totalXp;
    private int level;
    private int xpToNextLevel;
    private int progressPercent;
    private List<TaskResponse> tasks;

    public UserResponse(Long id, String username, String email, int totalXp, int level, int xpToNextLevel, int progressPercent, List<TaskResponse> tasks) {
        this.id = id;
        this.username = username;
        this.email = email;
        this.totalXp = totalXp;
        this.level = level;
        this.xpToNextLevel = xpToNextLevel;
        this.progressPercent = progressPercent;
        this.tasks = tasks;
    }

    public Long getId() { return id; }
    public String getUsername() { return username; }
    public String getEmail() { return email; }
    public int getTotalXp() { return totalXp; }
    public int getLevel() { return level; }
    public int getXpToNextLevel() { return xpToNextLevel; }
    public int getProgressPercent() { return progressPercent; }
    public List<TaskResponse> getTasks() { return tasks; }
}