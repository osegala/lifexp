package com.productivity.productivity.service;

import com.productivity.productivity.dto.BuildingInteriorResponse;
import com.productivity.productivity.dto.UpdateBuildingInteriorRequest;
import com.productivity.productivity.entity.BuildingType;
import com.productivity.productivity.entity.User;
import com.productivity.productivity.entity.UserBuilding;
import com.productivity.productivity.entity.UserBuildingInterior;
import com.productivity.productivity.repository.UserBuildingInteriorRepository;
import com.productivity.productivity.repository.UserBuildingRepository;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
public class BuildingInteriorService {
    private final CurrentUserService currentUserService;
    private final UserBuildingRepository userBuildingRepository;
    private final UserBuildingInteriorRepository interiorRepository;

    public BuildingInteriorService(CurrentUserService currentUserService, UserBuildingRepository userBuildingRepository, UserBuildingInteriorRepository interiorRepository) {
        this.currentUserService = currentUserService;
        this.userBuildingRepository = userBuildingRepository;
        this.interiorRepository = interiorRepository;
    }

    @Transactional
    public BuildingInteriorResponse getInteriorForCurrentUser(BuildingType type) {
        User user = currentUserService.getCurrentUser();
        UserBuilding building = userBuildingRepository.findByUserIdAndBuildingType(user.getId(), type)
                .orElseGet(() -> userBuildingRepository.save(new UserBuilding(user, type)));
        int visualTier = BuildingTierPolicy.visualTierForLevel(building.getLevel());
        boolean unlocked = visualTier >= 5;
        UserBuildingInterior interior = interiorRepository.findByUserIdAndBuildingType(user.getId(), type)
                .orElseGet(() -> interiorRepository.save(new UserBuildingInterior(user, type)));
        return mapToResponse(interior, visualTier, unlocked);
    }

    @Transactional
    public BuildingInteriorResponse updateInteriorForCurrentUser(BuildingType type, UpdateBuildingInteriorRequest request) {
        User user = currentUserService.getCurrentUser();
        UserBuilding building = userBuildingRepository.findByUserIdAndBuildingType(user.getId(), type)
                .orElseGet(() -> userBuildingRepository.save(new UserBuilding(user, type)));
        int visualTier = BuildingTierPolicy.visualTierForLevel(building.getLevel());

        if (visualTier < 5) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Building interiors unlock at tier 5");
        }

        UserBuildingInterior interior = interiorRepository.findByUserIdAndBuildingType(user.getId(), type)
                .orElseGet(() -> interiorRepository.save(new UserBuildingInterior(user, type)));
        interior.setWallStyle(nonBlankOr(request.getWallStyle(), interior.getWallStyle()));
        interior.setFloorStyle(nonBlankOr(request.getFloorStyle(), interior.getFloorStyle()));
        interior.setCenterItem(nonBlankOr(request.getCenterItem(), interior.getCenterItem()));
        interior.setLeftItem(nonBlankOr(request.getLeftItem(), interior.getLeftItem()));
        interior.setRightItem(nonBlankOr(request.getRightItem(), interior.getRightItem()));
        return mapToResponse(interiorRepository.save(interior), visualTier, true);
    }

    private BuildingInteriorResponse mapToResponse(UserBuildingInterior interior, int visualTier, boolean unlocked) {
        return new BuildingInteriorResponse(
                interior.getBuildingType(),
                unlocked,
                visualTier,
                interior.getWallStyle(),
                interior.getFloorStyle(),
                interior.getCenterItem(),
                interior.getLeftItem(),
                interior.getRightItem()
        );
    }

    private String nonBlankOr(String value, String fallback) {
        return value == null || value.isBlank() ? fallback : value.trim();
    }

}
