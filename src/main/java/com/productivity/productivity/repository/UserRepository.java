package com.productivity.productivity.repository;

import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;

import com.productivity.productivity.entity.User;

public interface UserRepository extends JpaRepository<User, Long> {
    Optional<User> findByEmail(String email);
    boolean existsByEmail(String email);
}

