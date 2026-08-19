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
    private int currentStreak;
    private int longestStreak;
    private int coins;
    private boolean premiumActive;
    private List<TaskResponse> tasks;

    public UserResponse(
            Long id,
            String username,
            String email,
            int totalXp,
            int level,
            int xpToNextLevel,
            int progressPercent,
            int currentStreak,
            int longestStreak,
            int coins,
            boolean premiumActive,
            List<TaskResponse> tasks
    ) {
        this.id = id;
        this.username = username;
        this.email = email;
        this.totalXp = totalXp;
        this.level = level;
        this.xpToNextLevel = xpToNextLevel;
        this.progressPercent = progressPercent;
        this.currentStreak = currentStreak;
        this.longestStreak = longestStreak;
        this.coins = coins;
        this.premiumActive = premiumActive;
        this.tasks = tasks;
    }

    public Long getId() { return id; }
    public String getUsername() { return username; }
    public String getEmail() { return email; }
    public int getTotalXp() { return totalXp; }
    public int getLevel() { return level; }
    public int getXpToNextLevel() { return xpToNextLevel; }
    public int getProgressPercent() { return progressPercent; }
    public int getCurrentStreak() { return currentStreak; }
    public int getLongestStreak() { return longestStreak; }
    public int getCoins() { return coins; }
    public boolean isPremiumActive() { return premiumActive; }
    public List<TaskResponse> getTasks() { return tasks; }
}
