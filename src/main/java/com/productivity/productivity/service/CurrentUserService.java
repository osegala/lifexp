package com.productivity.productivity.service;

import com.productivity.productivity.entity.User;
import com.productivity.productivity.exception.ResourceNotFoundException;
import com.productivity.productivity.repository.UserRepository;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;

@Service
public class CurrentUserService {

    private final UserRepository userRepository;

    public CurrentUserService(UserRepository userRepository) {
        this.userRepository = userRepository;
    }

    public User getCurrentUser() {
        String email = SecurityContextHolder
                .getContext()
                .getAuthentication()
                .getName();

        return userRepository.findByEmail(email)
                .orElseThrow(() -> new ResourceNotFoundException("Current user not found"));
    }

    public Long getCurrentUserId() {
        return getCurrentUser().getId();
    }
}
