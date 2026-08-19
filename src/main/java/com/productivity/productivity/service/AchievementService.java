package com.productivity.productivity.service;

import com.productivity.productivity.dto.AchievementResponse;
import com.productivity.productivity.entity.*;
import com.productivity.productivity.exception.ResourceNotFoundException;
import com.productivity.productivity.repository.*;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDate;
import java.util.List;

@Service
public class AchievementService {
    private record AchievementDefinition(String key, String title, String description, long target, int coinReward, String cosmeticReward) {}

    private static final List<AchievementDefinition> ACHIEVEMENTS = List.of(
            new AchievementDefinition("first-quest", "First Quest", "Complete your first quest.", 1, 20, "Starter Cap"),
            new AchievementDefinition("week-of-work", "Town Regular", "Complete 7 quests total.", 7, 60, "Gym Headband"),
            new AchievementDefinition("ten-day-streak", "Signal Fire", "Reach a 10 day streak.", 10, 120, "Golden Aura"),
            new AchievementDefinition("tier-five-building", "Master Builder", "Upgrade any building to visual tier 5.", 5, 200, "Tiny Dragon Pet")
    );

    private final CurrentUserService currentUserService;
    private final UserRepository userRepository;
    private final TaskCompletionRepository taskCompletionRepository;
    private final UserBuildingRepository userBuildingRepository;
    private final UserAchievementClaimRepository claimRepository;
    private final CosmeticRepository cosmeticRepository;
    private final UserCosmeticRepository userCosmeticRepository;

    public AchievementService(CurrentUserService currentUserService, UserRepository userRepository, TaskCompletionRepository taskCompletionRepository, UserBuildingRepository userBuildingRepository, UserAchievementClaimRepository claimRepository, CosmeticRepository cosmeticRepository, UserCosmeticRepository userCosmeticRepository) {
        this.currentUserService = currentUserService;
        this.userRepository = userRepository;
        this.taskCompletionRepository = taskCompletionRepository;
        this.userBuildingRepository = userBuildingRepository;
        this.claimRepository = claimRepository;
        this.cosmeticRepository = cosmeticRepository;
        this.userCosmeticRepository = userCosmeticRepository;
    }

    public List<AchievementResponse> getAchievementsForCurrentUser() {
        User user = currentUserService.getCurrentUser();
        return ACHIEVEMENTS.stream().map(definition -> mapToResponse(user, definition)).toList();
    }

    @Transactional
    public AchievementResponse claimAchievementForCurrentUser(String key) {
        User currentUser = currentUserService.getCurrentUser();
        User user = userRepository.findByIdForUpdate(currentUser.getId())
                .orElseThrow(() -> new ResourceNotFoundException("Current user not found"));
        AchievementDefinition definition = ACHIEVEMENTS.stream()
                .filter(item -> item.key().equals(key))
                .findFirst()
                .orElseThrow(() -> new ResourceNotFoundException("Achievement not found"));
        AchievementResponse response = mapToResponse(user, definition);

        if (!response.isCompleted()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Achievement is not complete yet");
        }

        if (response.isClaimed()) {
            return response;
        }

        user.setCoins(user.getCoins() + definition.coinReward());
        userRepository.save(user);
        unlockCosmeticReward(user, definition.cosmeticReward());
        claimRepository.save(new UserAchievementClaim(user, definition.key()));
        return mapToResponse(user, definition);
    }

    private AchievementResponse mapToResponse(User user, AchievementDefinition definition) {
        long progress = progressFor(user, definition.key());
        boolean completed = progress >= definition.target();
        boolean claimed = claimRepository.existsByUserIdAndAchievementKey(user.getId(), definition.key());

        return new AchievementResponse(
                definition.key(),
                definition.title(),
                definition.description(),
                progress,
                definition.target(),
                definition.coinReward(),
                definition.cosmeticReward(),
                completed,
                claimed
        );
    }

    private long progressFor(User user, String key) {
        return switch (key) {
            case "first-quest", "week-of-work" -> taskCompletionRepository.countByUser_Id(user.getId());
            case "ten-day-streak" -> user.getLongestStreak();
            case "tier-five-building" -> userBuildingRepository.findByUserIdOrderByBuildingTypeAsc(user.getId())
                    .stream()
                    .mapToInt(building -> BuildingTierPolicy.visualTierForLevel(building.getLevel()))
                    .max()
                    .orElse(1);
            default -> 0;
        };
    }

    private void unlockCosmeticReward(User user, String cosmeticName) {
        cosmeticRepository.findAll()
                .stream()
                .filter(cosmetic -> cosmetic.getName().equals(cosmeticName))
                .findFirst()
                .ifPresent(cosmetic -> {
                    if (!userCosmeticRepository.existsByUserIdAndCosmeticId(user.getId(), cosmetic.getId())) {
                        userCosmeticRepository.save(new UserCosmetic(user, cosmetic));
                    }
                });
    }

}
