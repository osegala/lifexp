package com.productivity.productivity.controller;

import com.productivity.productivity.dto.SubscriptionResponse;
import com.productivity.productivity.service.SubscriptionService;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/subscription")
public class SubscriptionController {
    private final SubscriptionService subscriptionService;

    public SubscriptionController(SubscriptionService subscriptionService) {
        this.subscriptionService = subscriptionService;
    }

    @GetMapping
    public SubscriptionResponse getStatus() {
        return subscriptionService.getStatusForCurrentUser();
    }

    @PostMapping("/dev/activate")
    public SubscriptionResponse activateDevPass() {
        return subscriptionService.activateDevPassForCurrentUser();
    }
}
