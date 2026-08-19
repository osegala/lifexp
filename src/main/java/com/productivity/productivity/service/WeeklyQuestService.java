package com.productivity.productivity.service;

import com.productivity.productivity.dto.WeeklyQuestResponse;
import com.productivity.productivity.entity.TaskCategory;
import com.productivity.productivity.entity.User;
import com.productivity.productivity.entity.UserWeeklyQuestClaim;
import com.productivity.productivity.exception.ResourceNotFoundException;
import com.productivity.productivity.repository.TaskCompletionRepository;
import com.productivity.productivity.repository.UserRepository;
import com.productivity.productivity.repository.UserWeeklyQuestClaimRepository;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.temporal.TemporalAdjusters;
import java.util.List;

@Service
public class WeeklyQuestService {
    private record WeeklyQuestDefinition(String key, String title, String storyText, String taskTitle, TaskCategory category, int requiredCompletions, int xpReward, int coinReward) {}

    private static final List<WeeklyQuestDefinition> QUESTS = List.of(
            new WeeklyQuestDefinition("defend-the-walls", "Defend the Walls", "Scouts saw raiders near the tree line. Complete fitness quests to reinforce the town defenses.", "Do 10 push-ups to build the defenses", TaskCategory.FITNESS, 3, 90, 35),
            new WeeklyQuestDefinition("restore-the-library", "Restore the Library", "The town archive is in chaos after a storm. Finish school quests to recover the lost plans.", "Study for 20 minutes to restore the records", TaskCategory.SCHOOL, 3, 100, 35),
            new WeeklyQuestDefinition("heal-the-garden", "Heal the Garden", "The apothecary needs fresh herbs before the next market day. Complete health quests to revive the garden.", "Drink water and prep a healthy snack", TaskCategory.HEALTH, 3, 80, 30),
            new WeeklyQuestDefinition("repair-the-workshop", "Repair the Workshop", "The blacksmith's tools are scattered. Complete work quests to get production moving again.", "Finish one focused work block", TaskCategory.WORK, 3, 110, 40),
            new WeeklyQuestDefinition("clean-the-home-base", "Secure Home Base", "Dust, clutter, and loose supplies are slowing the town down. Complete cleaning quests to reset the base.", "Clean one room or clear your desk", TaskCategory.CLEANING, 3, 70, 25),
            new WeeklyQuestDefinition("raise-the-banner", "Raise the Banner", "The town needs morale before the next challenge. Complete personal growth quests to rally everyone.", "Journal or plan tomorrow for 10 minutes", TaskCategory.PERSONAL_GROWTH, 3, 85, 30)
    );

    private final CurrentUserService currentUserService;
    private final UserRepository userRepository;
    private final TaskCompletionRepository taskCompletionRepository;
    private final UserWeeklyQuestClaimRepository claimRepository;

    public WeeklyQuestService(CurrentUserService currentUserService, UserRepository userRepository, TaskCompletionRepository taskCompletionRepository, UserWeeklyQuestClaimRepository claimRepository) {
        this.currentUserService = currentUserService;
        this.userRepository = userRepository;
        this.taskCompletionRepository = taskCompletionRepository;
        this.claimRepository = claimRepository;
    }

    public WeeklyQuestResponse getCurrentQuestForCurrentUser() {
        User user = currentUserService.getCurrentUser();
        return mapToResponse(user, currentDefinition(), weekStart(LocalDate.now()));
    }

    @Transactional
    public WeeklyQuestResponse claimCurrentQuestForCurrentUser() {
        User currentUser = currentUserService.getCurrentUser();
        User user = userRepository.findByIdForUpdate(currentUser.getId())
                .orElseThrow(() -> new ResourceNotFoundException("Current user not found"));
        LocalDate weekStart = weekStart(LocalDate.now());
        WeeklyQuestDefinition definition = currentDefinition();
        WeeklyQuestResponse response = mapToResponse(user, definition, weekStart);

        if (!response.isCompleted()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Weekly quest is not complete yet");
        }

        if (response.isClaimed()) {
            return response;
        }

        user.setCoins(user.getCoins() + definition.coinReward());
        user.setTotalXp(user.getTotalXp() + definition.xpReward());
        user.setLevel(calculateLevel(user.getTotalXp()));
        userRepository.save(user);
        claimRepository.save(new UserWeeklyQuestClaim(user, definition.key(), weekStart));

        return mapToResponse(user, definition, weekStart);
    }

    private WeeklyQuestDefinition currentDefinition() {
        long weekIndex = weekStart(LocalDate.now()).toEpochDay() / 7;
        return QUESTS.get((int) Math.floorMod(weekIndex, QUESTS.size()));
    }

    private WeeklyQuestResponse mapToResponse(User user, WeeklyQuestDefinition definition, LocalDate weekStart) {
        LocalDate weekEnd = weekStart.plusDays(6);
        long progress = taskCompletionRepository.countByUser_IdAndCompletionDateBetweenAndCategory(
                user.getId(),
                weekStart,
                weekEnd,
                definition.category()
        );
        boolean completed = progress >= definition.requiredCompletions();
        boolean claimed = claimRepository.existsByUserIdAndQuestKeyAndWeekStart(user.getId(), definition.key(), weekStart);

        return new WeeklyQuestResponse(
                definition.key(),
                definition.title(),
                definition.storyText(),
                definition.taskTitle(),
                definition.category(),
                definition.requiredCompletions(),
                progress,
                definition.xpReward(),
                definition.coinReward(),
                weekStart,
                weekEnd,
                completed,
                claimed
        );
    }

    private LocalDate weekStart(LocalDate date) {
        return date.with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY));
    }

    private int calculateLevel(int totalXp) {
        int level = 1;
        while (totalXp >= (int) (15 * Math.pow(level + 1, 2.2))) {
            level++;
        }
        return level;
    }
}
