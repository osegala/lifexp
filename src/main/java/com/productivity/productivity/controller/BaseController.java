package com.productivity.productivity.controller;

import com.productivity.productivity.dto.BaseResponse;
import com.productivity.productivity.dto.BuildingProgressResponse;
import com.productivity.productivity.entity.BuildingType;
import com.productivity.productivity.service.BuildingService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.bind.annotation.PathVariable;

@RestController
@RequestMapping("/api/base")
public class BaseController {

    private final BuildingService buildingService;

    public BaseController(BuildingService buildingService) {
        this.buildingService = buildingService;
    }

    @GetMapping
    public BaseResponse getMyBase() {
        return buildingService.getBaseForCurrentUser();
    }

    @GetMapping("/buildings/{type}")
    public BuildingProgressResponse getMyBuilding(@PathVariable String type) {
        return buildingService.getBuildingForCurrentUser(BuildingType.fromValue(type));
    }
}
