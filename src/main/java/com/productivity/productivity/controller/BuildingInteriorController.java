package com.productivity.productivity.controller;

import com.productivity.productivity.dto.BuildingInteriorResponse;
import com.productivity.productivity.dto.UpdateBuildingInteriorRequest;
import com.productivity.productivity.entity.BuildingType;
import com.productivity.productivity.service.BuildingInteriorService;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/base/interiors")
public class BuildingInteriorController {
    private final BuildingInteriorService buildingInteriorService;

    public BuildingInteriorController(BuildingInteriorService buildingInteriorService) {
        this.buildingInteriorService = buildingInteriorService;
    }

    @GetMapping("/{type}")
    public BuildingInteriorResponse getInterior(@PathVariable String type) {
        return buildingInteriorService.getInteriorForCurrentUser(BuildingType.fromValue(type));
    }

    @PutMapping("/{type}")
    public BuildingInteriorResponse updateInterior(
            @PathVariable String type,
            @RequestBody UpdateBuildingInteriorRequest request
    ) {
        return buildingInteriorService.updateInteriorForCurrentUser(BuildingType.fromValue(type), request);
    }
}
