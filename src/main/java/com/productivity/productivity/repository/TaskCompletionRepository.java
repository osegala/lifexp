package com.productivity.productivity.repository;

import com.productivity.productivity.entity.TaskCompletion;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDate;

public interface TaskCompletionRepository extends JpaRepository<TaskCompletion, Long> {
    boolean existsByUser_IdAndTask_IdAndCompletionDate(Long userId, Long taskId, LocalDate completionDate);
    long countByUser_IdAndCompletionDateBetween(Long userId, LocalDate start, LocalDate end);
    long countByUser_IdAndCompletionDateBetweenAndCategory(Long userId, LocalDate start, LocalDate end, com.productivity.productivity.entity.TaskCategory category);
    long countByUser_Id(Long userId);
}
