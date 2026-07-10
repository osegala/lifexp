package com.productivity.productivity.service;

import com.productivity.productivity.entity.RepeatType;
import com.productivity.productivity.entity.Task;
import com.productivity.productivity.entity.User;
import com.productivity.productivity.repository.TaskCompletionRepository;
import com.productivity.productivity.repository.TaskRepository;
import com.productivity.productivity.repository.UserRepository;
import org.junit.jupiter.api.Test;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDate;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.*;

class TaskServiceTests {

    @Test
    void repeatingTaskCannotAwardXpOnADateWhenItDoesNotOccur() {
        TaskRepository taskRepository = mock(TaskRepository.class);
        TaskCompletionRepository completionRepository = mock(TaskCompletionRepository.class);
        UserRepository userRepository = mock(UserRepository.class);
        AvatarService avatarService = mock(AvatarService.class);
        BuildingService buildingService = mock(BuildingService.class);
        CurrentUserService currentUserService = mock(CurrentUserService.class);
        TaskService service = new TaskService(
                taskRepository,
                completionRepository,
                userRepository,
                avatarService,
                buildingService,
                currentUserService
        );

        User user = mock(User.class);
        Task task = new Task();
        task.setUser(user);
        task.setDueDate(LocalDate.of(2026, 6, 1));
        task.setRepeatType(RepeatType.WEEKLY);
        task.setRepeatEndsAt(LocalDate.of(2026, 6, 30));

        when(user.getId()).thenReturn(3L);
        when(currentUserService.getCurrentUser()).thenReturn(user);
        when(taskRepository.findByIdForUpdate(9L)).thenReturn(Optional.of(task));
        when(userRepository.findByIdForUpdate(3L)).thenReturn(Optional.of(user));

        assertThrows(
                ResponseStatusException.class,
                () -> service.markTaskAsCompletedForCurrentUser(9L, LocalDate.of(2026, 6, 2))
        );

        verifyNoInteractions(completionRepository, avatarService, buildingService);
    }
}
