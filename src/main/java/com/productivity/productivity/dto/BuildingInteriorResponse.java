package com.productivity.productivity.dto;

import com.productivity.productivity.entity.BuildingType;

public class BuildingInteriorResponse {
    private final BuildingType buildingType;
    private final boolean unlocked;
    private final int visualTier;
    private final String wallStyle;
    private final String floorStyle;
    private final String centerItem;
    private final String leftItem;
    private final String rightItem;

    public BuildingInteriorResponse(BuildingType buildingType, boolean unlocked, int visualTier, String wallStyle, String floorStyle, String centerItem, String leftItem, String rightItem) {
        this.buildingType = buildingType;
        this.unlocked = unlocked;
        this.visualTier = visualTier;
        this.wallStyle = wallStyle;
        this.floorStyle = floorStyle;
        this.centerItem = centerItem;
        this.leftItem = leftItem;
        this.rightItem = rightItem;
    }

    public BuildingType getBuildingType() { return buildingType; }
    public boolean isUnlocked() { return unlocked; }
    public int getVisualTier() { return visualTier; }
    public String getWallStyle() { return wallStyle; }
    public String getFloorStyle() { return floorStyle; }
    public String getCenterItem() { return centerItem; }
    public String getLeftItem() { return leftItem; }
    public String getRightItem() { return rightItem; }
}
