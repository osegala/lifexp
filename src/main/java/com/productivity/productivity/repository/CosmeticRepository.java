package com.productivity.productivity.repository;

import com.productivity.productivity.entity.Cosmetic;
import com.productivity.productivity.entity.CosmeticType;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface CosmeticRepository extends JpaRepository<Cosmetic, Long> {
    List<Cosmetic> findByRequiredLevelLessThanEqual(int level);
    Optional<Cosmetic> findByNameAndType(String name, CosmeticType type);
}
