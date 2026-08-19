package com.productivity.productivity.repository;

import com.productivity.productivity.entity.BuildingType;
import com.productivity.productivity.entity.UserBuildingInterior;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface UserBuildingInteriorRepository extends JpaRepository<UserBuildingInterior, Long> {
    Optional<UserBuildingInterior> findByUserIdAndBuildingType(Long userId, BuildingType buildingType);
}
