package com.productivity.productivity.controller;

import com.productivity.productivity.dto.WeeklyQuestResponse;
import com.productivity.productivity.service.WeeklyQuestService;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/weekly-quests")
public class WeeklyQuestController {
    private final WeeklyQuestService weeklyQuestService;

    public WeeklyQuestController(WeeklyQuestService weeklyQuestService) {
        this.weeklyQuestService = weeklyQuestService;
    }

    @GetMapping("/current")
    public WeeklyQuestResponse getCurrentQuest() {
        return weeklyQuestService.getCurrentQuestForCurrentUser();
    }

    @PostMapping("/current/claim")
    public WeeklyQuestResponse claimCurrentQuest() {
        return weeklyQuestService.claimCurrentQuestForCurrentUser();
    }
}
