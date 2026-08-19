package com.productivity.productivity.controller;

import com.productivity.productivity.dto.AchievementResponse;
import com.productivity.productivity.service.AchievementService;
import java.util.List;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/achievements")
public class AchievementController {
    private final AchievementService achievementService;

    public AchievementController(AchievementService achievementService) {
        this.achievementService = achievementService;
    }

    @GetMapping
    public List<AchievementResponse> getAchievements() {
        return achievementService.getAchievementsForCurrentUser();
    }

    @PostMapping("/{key}/claim")
    public AchievementResponse claimAchievement(@PathVariable String key) {
        return achievementService.claimAchievementForCurrentUser(key);
    }
}
