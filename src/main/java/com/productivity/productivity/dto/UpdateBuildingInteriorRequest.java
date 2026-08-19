package com.productivity.productivity.dto;

public class UpdateBuildingInteriorRequest {
    private String wallStyle;
    private String floorStyle;
    private String centerItem;
    private String leftItem;
    private String rightItem;

    public String getWallStyle() { return wallStyle; }
    public String getFloorStyle() { return floorStyle; }
    public String getCenterItem() { return centerItem; }
    public String getLeftItem() { return leftItem; }
    public String getRightItem() { return rightItem; }

    public void setWallStyle(String wallStyle) { this.wallStyle = wallStyle; }
    public void setFloorStyle(String floorStyle) { this.floorStyle = floorStyle; }
    public void setCenterItem(String centerItem) { this.centerItem = centerItem; }
    public void setLeftItem(String leftItem) { this.leftItem = leftItem; }
    public void setRightItem(String rightItem) { this.rightItem = rightItem; }
}
