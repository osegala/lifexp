package com.productivity.productivity.repository;

import com.productivity.productivity.entity.UserAchievementClaim;
import org.springframework.data.jpa.repository.JpaRepository;

public interface UserAchievementClaimRepository extends JpaRepository<UserAchievementClaim, Long> {
    boolean existsByUserIdAndAchievementKey(Long userId, String achievementKey);
}
