package com.productivity.productivity.repository;

import com.productivity.productivity.entity.TaskCompletion;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDate;

public interface TaskCompletionRepository extends JpaRepository<TaskCompletion, Long> {
    boolean existsByUser_IdAndTask_IdAndCompletionDate(Long userId, Long taskId, LocalDate completionDate);
}
