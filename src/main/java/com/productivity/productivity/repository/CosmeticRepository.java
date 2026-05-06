package com.productivity.productivity.repository;

import com.productivity.productivity.entity.Cosmetic;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface CosmeticRepository extends JpaRepository<Cosmetic, Long> {
    List<Cosmetic> findByRequiredLevelLessThanEqual(int level);
}
