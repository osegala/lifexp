package com.productivity.productivity.dto;

import java.util.List;

public class BaseResponse {
    private final int baseLevel;
    private final List<BuildingProgressResponse> buildings;

    public BaseResponse(int baseLevel, List<BuildingProgressResponse> buildings) {
        this.baseLevel = baseLevel;
        this.buildings = buildings;
    }

    public int getBaseLevel() { return baseLevel; }
    public List<BuildingProgressResponse> getBuildings() { return buildings; }
}
