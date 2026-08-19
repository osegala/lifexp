package com.productivity.productivity.dto;

public class SocialUserResponse {
    private final Long id;
    private final String username;
    private final int level;
    private final int currentStreak;

    public SocialUserResponse(Long id, String username, int level, int currentStreak) {
        this.id = id;
        this.username = username;
        this.level = level;
        this.currentStreak = currentStreak;
    }

    public Long getId() { return id; }
    public String getUsername() { return username; }
    public int getLevel() { return level; }
    public int getCurrentStreak() { return currentStreak; }
}
