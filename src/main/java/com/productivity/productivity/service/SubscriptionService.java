package com.productivity.productivity.service;

import com.productivity.productivity.dto.SubscriptionResponse;
import com.productivity.productivity.entity.User;
import com.productivity.productivity.exception.ResourceNotFoundException;
import com.productivity.productivity.repository.UserRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class SubscriptionService {
    private final CurrentUserService currentUserService;
    private final UserRepository userRepository;

    public SubscriptionService(CurrentUserService currentUserService, UserRepository userRepository) {
        this.currentUserService = currentUserService;
        this.userRepository = userRepository;
    }

    public SubscriptionResponse getStatusForCurrentUser() {
        User user = currentUserService.getCurrentUser();
        return mapToResponse(user, "revenuecat-ready");
    }

    @Transactional
    public SubscriptionResponse activateDevPassForCurrentUser() {
        User currentUser = currentUserService.getCurrentUser();
        User user = userRepository.findByIdForUpdate(currentUser.getId())
                .orElseThrow(() -> new ResourceNotFoundException("Current user not found"));
        user.setPremiumActive(true);
        return mapToResponse(userRepository.save(user), "dev");
    }

    private SubscriptionResponse mapToResponse(User user, String provider) {
        return new SubscriptionResponse(
                user.isPremiumActive(),
                user.isPremiumActive() ? "lifexp_pass" : "free",
                provider,
                "LifeXP Pass",
                "Premium cosmetics and a progression boost for the long road.",
                1.5
        );
    }
}
