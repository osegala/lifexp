package com.productivity.productivity.service;

import com.productivity.productivity.dto.CreateTaskRequest;
import com.productivity.productivity.dto.BuildingProgressResponse;
import com.productivity.productivity.dto.TaskResponse;
import com.productivity.productivity.entity.RepeatType;
import com.productivity.productivity.entity.BuildingType;
import com.productivity.productivity.entity.Task;
import com.productivity.productivity.entity.TaskCompletion;
import com.productivity.productivity.entity.User;
import com.productivity.productivity.exception.ResourceNotFoundException;
import com.productivity.productivity.repository.TaskCompletionRepository;
import com.productivity.productivity.repository.TaskRepository;
import com.productivity.productivity.repository.UserRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.http.HttpStatus;

import java.time.LocalDate;
import java.time.LocalTime;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.util.Locale;
import java.util.List;

@Service
public class TaskService {

    private static final List<DateTimeFormatter> TIME_FORMATTERS = List.of(
            DateTimeFormatter.ISO_LOCAL_TIME,
            DateTimeFormatter.ofPattern("H:mm", Locale.US),
            DateTimeFormatter.ofPattern("h:mm a", Locale.US),
            DateTimeFormatter.ofPattern("h:mma", Locale.US),
            DateTimeFormatter.ofPattern("h a", Locale.US),
            DateTimeFormatter.ofPattern("ha", Locale.US)
    );

    private final TaskRepository taskRepository;
    private final TaskCompletionRepository taskCompletionRepository;
    private final UserRepository userRepository;
    private final AvatarService avatarService;
    private final BuildingService buildingService;
    private final CurrentUserService currentUserService;

    public TaskService(
            TaskRepository taskRepository,
            TaskCompletionRepository taskCompletionRepository,
            UserRepository userRepository,
            AvatarService avatarService,
            BuildingService buildingService,
            CurrentUserService currentUserService
    ) {
        this.taskRepository = taskRepository;
        this.taskCompletionRepository = taskCompletionRepository;
        this.userRepository = userRepository;
        this.avatarService = avatarService;
        this.buildingService = buildingService;
        this.currentUserService = currentUserService;
    }

    public TaskResponse createTaskForCurrentUser(CreateTaskRequest request) {
        User user = currentUserService.getCurrentUser();

        Task task = new Task();
        task.setTitle(request.getTitle());
        task.setDescription(request.getDescription());
        task.setXpValue(request.getCategory().getXpReward());
        task.setDueDate(request.getDueDate());
        task.setScheduledTime(parseScheduledTime(request.getScheduledTime()));
        task.setRepeatType(request.getRepeatType());
        validateRepeatWindow(task.getRepeatType(), request.getDueDate(), request.getRepeatEndsAt());
        task.setRepeatEndsAt(task.getRepeatType() == RepeatType.NONE ? null : request.getRepeatEndsAt());
        task.setCategory(request.getCategory());
        task.setCompleted(false);
        task.setUser(user);

        return mapToTaskResponse(taskRepository.save(task));
    }

    public List<TaskResponse> getTasksForCurrentUser() {
        return getTasksForCurrentUser(null);
    }

    public List<TaskResponse> getTasksForCurrentUser(LocalDate date) {
        User user = currentUserService.getCurrentUser();

        return taskRepository.findByUserId(user.getId())
                .stream()
                .filter(task -> !task.isArchived())
                .filter(task -> date == null || occursOn(task, date))
                .map(task -> mapToTaskResponse(task, date))
                .toList();
    }

    public TaskResponse getTaskByIdForCurrentUser(Long id) {
        Task task = getOwnedTask(id);
        return mapToTaskResponse(task);
    }

    public TaskResponse markTaskAsCompletedForCurrentUser(Long id) {
        return markTaskAsCompletedForCurrentUser(id, LocalDate.now());
    }

    @Transactional
    public TaskResponse markTaskAsCompletedForCurrentUser(Long id, LocalDate completionDate) {
        Task task = getOwnedTaskForUpdate(id);
        User user = userRepository.findByIdForUpdate(task.getUser().getId())
                .orElseThrow(() -> new ResourceNotFoundException("Current user not found"));
        LocalDate effectiveCompletionDate = completionDate == null ? LocalDate.now() : completionDate;

        if (!occursOn(task, effectiveCompletionDate)) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Task does not occur on " + effectiveCompletionDate
            );
        }

        boolean alreadyCompletedForDate = taskCompletionRepository.existsByUser_IdAndTask_IdAndCompletionDate(
                user.getId(),
                task.getId(),
                effectiveCompletionDate
        );

        boolean legacyAlreadyCompleted = task.isCompleted() && task.getRepeatType() == RepeatType.NONE;
        TaskResponse response;

        if (!alreadyCompletedForDate && !legacyAlreadyCompleted) {
            taskCompletionRepository.save(new TaskCompletion(
                    user,
                    task,
                    effectiveCompletionDate,
                    task.getXpValue(),
                    task.getCategory(),
                    BuildingType.forCategory(task.getCategory())
            ));

            if (task.getRepeatType() == RepeatType.NONE) {
                task.setCompleted(true);
            }

            int previousLevel = user.getLevel();
            user.setTotalXp(user.getTotalXp() + task.getXpValue());

            int newLevel = calculateLevel(user.getTotalXp());
            user.setLevel(newLevel);

            User savedUser = userRepository.save(user);
            List<String> unlockedCosmetics = avatarService.unlockCosmeticsForUserWithResult(savedUser);
            BuildingProgressResponse buildingProgress =
                    buildingService.awardTaskXp(savedUser, task.getCategory(), task.getXpValue());

            response = mapToTaskResponse(taskRepository.save(task), effectiveCompletionDate);
            response.setUnlockedCosmetics(unlockedCosmetics);
            response.setBuildingProgress(buildingProgress);
            response.setLeveledUp(newLevel > previousLevel);
            return response;
        }

        return mapToTaskResponse(taskRepository.save(task), effectiveCompletionDate);
    }

    public TaskResponse updateTaskForCurrentUser(Long id, CreateTaskRequest request) {
        Task existingTask = getOwnedTask(id);

        existingTask.setTitle(request.getTitle());
        existingTask.setDescription(request.getDescription());
        existingTask.setXpValue(request.getCategory().getXpReward());
        existingTask.setDueDate(request.getDueDate());
        existingTask.setScheduledTime(parseScheduledTime(request.getScheduledTime()));
        existingTask.setRepeatType(request.getRepeatType());
        validateRepeatWindow(existingTask.getRepeatType(), request.getDueDate(), request.getRepeatEndsAt());
        existingTask.setRepeatEndsAt(
                existingTask.getRepeatType() == RepeatType.NONE ? null : request.getRepeatEndsAt()
        );
        existingTask.setCategory(request.getCategory());

        return mapToTaskResponse(taskRepository.save(existingTask));
    }

    public void deleteTaskForCurrentUser(Long id) {
        Task task = getOwnedTask(id);
        task.setArchived(true);
        taskRepository.save(task);
    }

    private Task getOwnedTask(Long taskId) {
        User currentUser = currentUserService.getCurrentUser();

        Task task = taskRepository.findById(taskId)
                .orElseThrow(() -> new ResourceNotFoundException("Task with ID " + taskId + " not found"));

        if (!task.getUser().getId().equals(currentUser.getId())) {
            throw new ResourceNotFoundException("Task with ID " + taskId + " not found");
        }

        if (task.isArchived()) {
            throw new ResourceNotFoundException("Task with ID " + taskId + " not found");
        }

        return task;
    }

    private Task getOwnedTaskForUpdate(Long taskId) {
        User currentUser = currentUserService.getCurrentUser();

        Task task = taskRepository.findByIdForUpdate(taskId)
                .orElseThrow(() -> new ResourceNotFoundException("Task with ID " + taskId + " not found"));

        if (!task.getUser().getId().equals(currentUser.getId())) {
            throw new ResourceNotFoundException("Task with ID " + taskId + " not found");
        }

        if (task.isArchived()) {
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

    private LocalTime parseScheduledTime(String scheduledTime) {
        if (scheduledTime == null || scheduledTime.isBlank()) {
            return null;
        }

        String normalizedTime = scheduledTime.trim().toUpperCase(Locale.US);

        for (DateTimeFormatter formatter : TIME_FORMATTERS) {
            try {
                return LocalTime.parse(normalizedTime, formatter);
            } catch (DateTimeParseException ignored) {
                // Try the next supported time format.
            }
        }

        throw new ResponseStatusException(
                HttpStatus.BAD_REQUEST,
                "scheduledTime must be in HH:mm format, like 22:00, or h:mm AM/PM, like 10:00 PM"
        );
    }

    private void validateRepeatWindow(RepeatType repeatType, LocalDate dueDate, LocalDate repeatEndsAt) {
        if (repeatType != RepeatType.NONE && dueDate == null) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "dueDate is required for repeating tasks"
            );
        }

        if (repeatType != RepeatType.NONE && repeatEndsAt == null) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "repeatEndsAt is required for repeating tasks"
            );
        }

        if (dueDate != null && repeatEndsAt != null && repeatEndsAt.isBefore(dueDate)) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "repeatEndsAt must be on or after dueDate"
            );
        }
    }

    private TaskResponse mapToTaskResponse(Task task) {
        return mapToTaskResponse(task, null);
    }

    private TaskResponse mapToTaskResponse(Task task, LocalDate date) {
        boolean completed = task.isCompleted();

        if (date != null) {
            completed = taskCompletionRepository.existsByUser_IdAndTask_IdAndCompletionDate(
                    task.getUser().getId(),
                    task.getId(),
                    date
            );
        }

        return new TaskResponse(
                task.getId(),
                task.getTitle(),
                task.getDescription(),
                task.getXpValue(),
                task.getDueDate(),
                task.getScheduledTime(),
                task.getRepeatType(),
                task.getRepeatEndsAt(),
                task.getCategory(),
                completed
        );
    }

    private boolean occursOn(Task task, LocalDate date) {
        if (task.getDueDate() == null) {
            return true;
        }

        RepeatType repeatType = task.getRepeatType();

        if (repeatType == RepeatType.NONE) {
            return task.getDueDate().equals(date);
        }

        if (date.isBefore(task.getDueDate())) {
            return false;
        }

        if (task.getRepeatEndsAt() != null && date.isAfter(task.getRepeatEndsAt())) {
            return false;
        }

        return switch (repeatType) {
            case DAILY -> true;
            case WEEKLY -> task.getDueDate().getDayOfWeek().equals(date.getDayOfWeek());
            case NONE -> task.getDueDate().equals(date);
        };
    }
}
