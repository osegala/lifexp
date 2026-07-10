package com.productivity.productivity.repository;

import com.productivity.productivity.entity.BuildingType;
import com.productivity.productivity.entity.UserBuilding;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import jakarta.persistence.LockModeType;

import java.util.List;
import java.util.Optional;

public interface UserBuildingRepository extends JpaRepository<UserBuilding, Long> {
    List<UserBuilding> findByUserIdOrderByBuildingTypeAsc(Long userId);
    Optional<UserBuilding> findByUserIdAndBuildingType(Long userId, BuildingType buildingType);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select building from UserBuilding building where building.user.id = :userId and building.buildingType = :buildingType")
    Optional<UserBuilding> findByUserIdAndBuildingTypeForUpdate(Long userId, BuildingType buildingType);
}
