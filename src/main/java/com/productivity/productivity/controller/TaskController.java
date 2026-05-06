package com.productivity.productivity.controller;

import com.productivity.productivity.dto.CreateTaskRequest;
import com.productivity.productivity.dto.TaskResponse;
import com.productivity.productivity.service.TaskService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/tasks")
public class TaskController {

    private final TaskService taskService;

    public TaskController(TaskService taskService) {
        this.taskService = taskService;
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public TaskResponse createTask(@Valid @RequestBody CreateTaskRequest request) {
        return taskService.createTaskForCurrentUser(request);
    }

    @GetMapping
    public List<TaskResponse> getMyTasks() {
        return taskService.getTasksForCurrentUser();
    }

    @GetMapping("/{id}")
    public TaskResponse getTask(@PathVariable Long id) {
        return taskService.getTaskByIdForCurrentUser(id);
    }

    @PutMapping("/{id}")
    public TaskResponse updateTask(
            @PathVariable Long id,
            @Valid @RequestBody CreateTaskRequest request
    ) {
        return taskService.updateTaskForCurrentUser(id, request);
    }

    @PutMapping("/{id}/complete")
    public TaskResponse completeTask(@PathVariable Long id) {
        return taskService.markTaskAsCompletedForCurrentUser(id);
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteTask(@PathVariable Long id) {
        taskService.deleteTaskForCurrentUser(id);
    }
}