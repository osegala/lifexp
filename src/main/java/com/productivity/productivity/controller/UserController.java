package com.productivity.productivity.controller;

import com.productivity.productivity.dto.AuthResponse;
import com.productivity.productivity.dto.CreateUserRequest;
import com.productivity.productivity.dto.LoginRequest;
import com.productivity.productivity.dto.UserResponse;
import com.productivity.productivity.service.UserService;
import jakarta.validation.Valid;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/users")
public class UserController {

    @Autowired
    private UserService userService;


    @PostMapping("/register")
    @ResponseStatus(HttpStatus.CREATED)
    public AuthResponse registerUser(@Valid @RequestBody CreateUserRequest request) {
        return userService.registerUser(request);
    }

    @PostMapping("/login")
    public AuthResponse loginUser(@Valid @RequestBody LoginRequest request) {
        return userService.loginUser(request);
    }

    @GetMapping("/me")
    public UserResponse getMe() {
        return userService.getCurrentUserProfile();
    }

    @GetMapping("/id/{id}")
    public UserResponse getUser(@PathVariable Long id) {
        return userService.getUserProfile(id);
    }

    @PutMapping("/id/{id}")
    public UserResponse updateUser(@PathVariable Long id, @Valid @RequestBody CreateUserRequest request) {
        return userService.updateUserProfile(id, request);
    }

    @DeleteMapping("/id/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteUser(@PathVariable Long id) {
        userService.deleteUserProfile(id);
    }
}