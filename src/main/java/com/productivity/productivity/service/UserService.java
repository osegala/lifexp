package com.productivity.productivity.service;

import com.productivity.productivity.dto.AuthResponse;
import com.productivity.productivity.dto.CreateUserRequest;
import com.productivity.productivity.dto.LoginRequest;
import com.productivity.productivity.dto.TaskResponse;
import com.productivity.productivity.dto.UserResponse;
import com.productivity.productivity.entity.Task;
import com.productivity.productivity.entity.User;
import com.productivity.productivity.exception.DuplicateResourceException;
import com.productivity.productivity.exception.ResourceNotFoundException;
import com.productivity.productivity.repository.UserRepository;
import com.productivity.productivity.security.JwtService;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
public class UserService {

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private PasswordEncoder passwordEncoder;

    @Autowired
    private JwtService jwtService;

    @Autowired
    private AuthenticationManager authenticationManager;

    @Autowired
    private AvatarService avatarService;

    @Autowired
    private CurrentUserService currentUserService;

    public AuthResponse registerUser(CreateUserRequest request) {
        if (userRepository.existsByEmail(request.getEmail())) {
            throw new DuplicateResourceException("Email is already in use");
        }

        User user = new User();
        user.setUsername(request.getUsername());
        user.setEmail(request.getEmail());
        user.setPassword(passwordEncoder.encode(request.getPassword()));
        user.setTotalXp(0);
        user.setLevel(1);

        User savedUser = userRepository.save(user);

        avatarService.createDefaultAvatar(savedUser);
        avatarService.unlockCosmeticsForUser(savedUser);

        String token = jwtService.generateToken(savedUser.getEmail());

        return new AuthResponse(token, mapToUserResponse(savedUser));
    }

    public AuthResponse loginUser(LoginRequest request) {
        authenticationManager.authenticate(
                new UsernamePasswordAuthenticationToken(
                        request.getEmail(),
                        request.getPassword()
                )
        );

        User user = userRepository.findByEmail(request.getEmail())
                .orElseThrow(() -> new ResourceNotFoundException("User not found"));

        String token = jwtService.generateToken(user.getEmail());

        return new AuthResponse(token, mapToUserResponse(user));
    }

    public UserResponse getUserProfile(Long userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("User with ID " + userId + " not found"));

        return mapToUserResponse(user);
    }

    public UserResponse updateUserProfile(Long userId, CreateUserRequest request) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("User with ID " + userId + " not found"));

        user.setUsername(request.getUsername());
        user.setEmail(request.getEmail());
        user.setPassword(passwordEncoder.encode(request.getPassword()));

        return mapToUserResponse(userRepository.save(user));
    }

    public void deleteUserProfile(Long userId) {
        if (!userRepository.existsById(userId)) {
            throw new ResourceNotFoundException("User with ID " + userId + " not found");
        }

        userRepository.deleteById(userId);
    }

    private UserResponse mapToUserResponse(User user) {
        List<TaskResponse> taskResponses = user.getTasks()
                .stream()
                .map(this::mapToTaskResponse)
                .toList();

        return new UserResponse(
                user.getId(),
                user.getUsername(),
                user.getEmail(),
                user.getTotalXp(),
                user.getLevel(),
                xpToNextLevel(user.getTotalXp(), user.getLevel()),
                calculatedProgressPercent(user.getTotalXp(), user.getLevel()),
                taskResponses
        );
    }

    public UserResponse getCurrentUserProfile() {
        User user = currentUserService.getCurrentUser();
        return mapToUserResponse(user);
    }

    private TaskResponse mapToTaskResponse(Task task) {
        return new TaskResponse(
                task.getId(),
                task.getTitle(),
                task.getDescription(),
                task.getXpValue(),
                task.getDueDate(),
                task.getCategory(),
                task.isCompleted()
        );
    }

    private int calculatedProgressPercent(int totalXp, int level) {
        int xpForCurrentLevel = totalXpForLevel(level);
        int xpForNextLevel = totalXpForLevel(level + 1);

        int xpIntoLevel = totalXp - xpForCurrentLevel;
        int xpRequired = xpForNextLevel - xpForCurrentLevel;

        if (xpRequired == 0) {
            return 100; // Avoid division by zero, user is at max level
        }   

        return (int) ((xpIntoLevel * 100.0) / xpRequired);
    }

    private int totalXpForLevel(int level) {
        return (int) (15 * Math.pow(level, 2.2));
    }

    private int xpToNextLevel(int totalXp, int level) {
        return totalXpForLevel(level + 1) - totalXp;
    }
}