package com.productivity.productivity.dto;

public class AchievementResponse {
    private final String key;
    private final String title;
    private final String description;
    private final long progress;
    private final long target;
    private final int coinReward;
    private final String cosmeticReward;
    private final boolean completed;
    private final boolean claimed;

    public AchievementResponse(String key, String title, String description, long progress, long target, int coinReward, String cosmeticReward, boolean completed, boolean claimed) {
        this.key = key;
        this.title = title;
        this.description = description;
        this.progress = progress;
        this.target = target;
        this.coinReward = coinReward;
        this.cosmeticReward = cosmeticReward;
        this.completed = completed;
        this.claimed = claimed;
    }

    public String getKey() { return key; }
    public String getTitle() { return title; }
    public String getDescription() { return description; }
    public long getProgress() { return progress; }
    public long getTarget() { return target; }
    public int getCoinReward() { return coinReward; }
    public String getCosmeticReward() { return cosmeticReward; }
    public boolean isCompleted() { return completed; }
    public boolean isClaimed() { return claimed; }
}
