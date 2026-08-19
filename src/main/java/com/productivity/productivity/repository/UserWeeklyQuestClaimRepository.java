package com.productivity.productivity.repository;

import com.productivity.productivity.entity.UserWeeklyQuestClaim;
import java.time.LocalDate;
import org.springframework.data.jpa.repository.JpaRepository;

public interface UserWeeklyQuestClaimRepository extends JpaRepository<UserWeeklyQuestClaim, Long> {
    boolean existsByUserIdAndQuestKeyAndWeekStart(Long userId, String questKey, LocalDate weekStart);
}
