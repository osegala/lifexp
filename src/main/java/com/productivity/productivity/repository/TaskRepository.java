package com.productivity.productivity.repository;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;

import com.productivity.productivity.entity.Task;

public interface TaskRepository extends JpaRepository<Task, Long> {
    List<Task> findByUserId(Long userId);
}

