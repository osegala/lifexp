package com.productivity.productivity.service;

import com.productivity.productivity.dto.CreateTaskRequest;
import com.productivity.productivity.dto.TaskResponse;
import com.productivity.productivity.entity.Task;
import com.productivity.productivity.entity.User;
import com.productivity.productivity.exception.ResourceNotFoundException;
import com.productivity.productivity.repository.TaskRepository;
import com.productivity.productivity.repository.UserRepository;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
public class TaskService {

    private final TaskRepository taskRepository;
    private final UserRepository userRepository;
    private final AvatarService avatarService;
    private final CurrentUserService currentUserService;

    public TaskService(
            TaskRepository taskRepository,
            UserRepository userRepository,
            AvatarService avatarService,
            CurrentUserService currentUserService
    ) {
        this.taskRepository = taskRepository;
        this.userRepository = userRepository;
        this.avatarService = avatarService;
        this.currentUserService = currentUserService;
    }

    public TaskResponse createTaskForCurrentUser(CreateTaskRequest request) {
        User user = currentUserService.getCurrentUser();

        Task task = new Task();
        task.setTitle(request.getTitle());
        task.setDescription(request.getDescription());
        task.setXpValue(request.getXpValue());
        task.setDueDate(request.getDueDate());
        task.setCategory(request.getCategory());
        task.setCompleted(false);
        task.setUser(user);

        return mapToTaskResponse(taskRepository.save(task));
    }

    public List<TaskResponse> getTasksForCurrentUser() {
        User user = currentUserService.getCurrentUser();

        return taskRepository.findByUserId(user.getId())
                .stream()
                .map(this::mapToTaskResponse)
                .toList();
    }

    public TaskResponse getTaskByIdForCurrentUser(Long id) {
        Task task = getOwnedTask(id);
        return mapToTaskResponse(task);
    }

    public TaskResponse markTaskAsCompletedForCurrentUser(Long id) {
        Task task = getOwnedTask(id);

        if (!task.isCompleted()) {
            task.setCompleted(true);

            User user = task.getUser();
            user.setTotalXp(user.getTotalXp() + task.getXpValue());

            int newLevel = calculateLevel(user.getTotalXp());
            user.setLevel(newLevel);

            User savedUser = userRepository.save(user);
            avatarService.unlockCosmeticsForUser(savedUser);
        }

        return mapToTaskResponse(taskRepository.save(task));
    }

    public TaskResponse updateTaskForCurrentUser(Long id, CreateTaskRequest request) {
        Task existingTask = getOwnedTask(id);

        existingTask.setTitle(request.getTitle());
        existingTask.setDescription(request.getDescription());
        existingTask.setXpValue(request.getXpValue());
        existingTask.setDueDate(request.getDueDate());
        existingTask.setCategory(request.getCategory());

        return mapToTaskResponse(taskRepository.save(existingTask));
    }

    public void deleteTaskForCurrentUser(Long id) {
        Task task = getOwnedTask(id);
        taskRepository.delete(task);
    }

    private Task getOwnedTask(Long taskId) {
        User currentUser = currentUserService.getCurrentUser();

        Task task = taskRepository.findById(taskId)
                .orElseThrow(() -> new ResourceNotFoundException("Task with ID " + taskId + " not found"));

        if (!task.getUser().getId().equals(currentUser.getId())) {
            throw new ResourceNotFoundException("Task with ID " + taskId + " not found");
        }

        return task;
    }

    private int calculateLevel(int totalXp) {
        int level = 1;

        while (totalXp >= totalXpForLevel(level + 1)) {
            level++;
        }

        return level;
    }

    private int totalXpForLevel(int level) {
        return (int) (15 * Math.pow(level, 2.2));
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
}