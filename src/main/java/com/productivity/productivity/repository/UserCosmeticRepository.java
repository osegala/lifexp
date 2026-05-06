package com.productivity.productivity.repository;

import com.productivity.productivity.entity.UserCosmetic;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface UserCosmeticRepository extends JpaRepository<UserCosmetic, Long> {
    List<UserCosmetic> findByUserId(Long userId);
    boolean existsByUserIdAndCosmeticId(Long userId, Long cosmeticId);
    Optional<UserCosmetic> findByUserIdAndCosmeticId(Long userId, Long cosmeticId);
}