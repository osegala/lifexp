package com.productivity.productivity.service;

import com.productivity.productivity.dto.BaseResponse;
import com.productivity.productivity.dto.BuildingProgressResponse;
import com.productivity.productivity.entity.BuildingType;
import com.productivity.productivity.entity.TaskCategory;
import com.productivity.productivity.entity.User;
import com.productivity.productivity.entity.UserBuilding;
import com.productivity.productivity.repository.UserBuildingRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
public class BuildingService {

    private final UserBuildingRepository userBuildingRepository;
    private final CurrentUserService currentUserService;

    public BuildingService(
            UserBuildingRepository userBuildingRepository,
            CurrentUserService currentUserService
    ) {
        this.userBuildingRepository = userBuildingRepository;
        this.currentUserService = currentUserService;
    }

    @Transactional
    public void createDefaultBuildings(User user) {
        for (BuildingType type : BuildingType.values()) {
            userBuildingRepository.findByUserIdAndBuildingType(user.getId(), type)
                    .orElseGet(() -> userBuildingRepository.save(new UserBuilding(user, type)));
        }
    }

    @Transactional
    public BuildingProgressResponse awardTaskXp(User user, TaskCategory category, int xpAmount) {
        BuildingType type = BuildingType.forCategory(category);
        UserBuilding building = userBuildingRepository.findByUserIdAndBuildingTypeForUpdate(user.getId(), type)
                .orElseGet(() -> userBuildingRepository.save(new UserBuilding(user, type)));

        building.setTotalXp(building.getTotalXp() + xpAmount);
        building.setLevel(calculateLevel(building.getTotalXp()));

        return mapToResponse(userBuildingRepository.save(building));
    }

    @Transactional
    public BaseResponse getBaseForCurrentUser() {
        User user = currentUserService.getCurrentUser();
        createDefaultBuildings(user);

        List<BuildingProgressResponse> buildings = userBuildingRepository
                .findByUserIdOrderByBuildingTypeAsc(user.getId())
                .stream()
                .map(this::mapToResponse)
                .toList();

        int baseLevel = buildings.stream()
                .mapToInt(BuildingProgressResponse::getLevel)
                .min()
                .orElse(1);

        return new BaseResponse(baseLevel, buildings);
    }

    @Transactional
    public BuildingProgressResponse getBuildingForCurrentUser(BuildingType type) {
        User user = currentUserService.getCurrentUser();

        UserBuilding building = userBuildingRepository.findByUserIdAndBuildingType(user.getId(), type)
                .orElseGet(() -> userBuildingRepository.save(new UserBuilding(user, type)));

        return mapToResponse(building);
    }

    private BuildingProgressResponse mapToResponse(UserBuilding building) {
        int level = building.getLevel();
        int currentLevelStart = totalXpForLevel(level);
        int nextLevelStart = totalXpForLevel(level + 1);
        int xpIntoLevel = building.getTotalXp() - currentLevelStart;
        int levelRange = nextLevelStart - currentLevelStart;
        int progressPercent = levelRange == 0 ? 100 : (int) ((xpIntoLevel * 100.0) / levelRange);

        return new BuildingProgressResponse(
                building.getBuildingType(),
                level,
                building.getTotalXp(),
                xpIntoLevel,
                nextLevelStart - building.getTotalXp(),
                progressPercent,
                visualTierForLevel(level)
        );
    }

    private int calculateLevel(int totalXp) {
        int level = 1;

        while (totalXp >= totalXpForLevel(level + 1)) {
            level++;
        }

        return level;
    }

    private int totalXpForLevel(int level) {
        return (int) (40 * Math.pow(level - 1, 1.8));
    }

    private int visualTierForLevel(int level) {
        return Math.min(5, 1 + ((level - 1) / 5));
    }
}
