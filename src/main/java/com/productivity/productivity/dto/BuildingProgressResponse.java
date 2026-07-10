package com.productivity.productivity.dto;

import com.productivity.productivity.entity.BuildingType;

public class BuildingProgressResponse {
    private final BuildingType type;
    private final int level;
    private final int totalXp;
    private final int xpIntoLevel;
    private final int xpToNextLevel;
    private final int progressPercent;
    private final int visualTier;

    public BuildingProgressResponse(
            BuildingType type,
            int level,
            int totalXp,
            int xpIntoLevel,
            int xpToNextLevel,
            int progressPercent,
            int visualTier
    ) {
        this.type = type;
        this.level = level;
        this.totalXp = totalXp;
        this.xpIntoLevel = xpIntoLevel;
        this.xpToNextLevel = xpToNextLevel;
        this.progressPercent = progressPercent;
        this.visualTier = visualTier;
    }

    public BuildingType getType() { return type; }
    public int getLevel() { return level; }
    public int getTotalXp() { return totalXp; }
    public int getXpIntoLevel() { return xpIntoLevel; }
    public int getXpToNextLevel() { return xpToNextLevel; }
    public int getProgressPercent() { return progressPercent; }
    public int getVisualTier() { return visualTier; }
}
