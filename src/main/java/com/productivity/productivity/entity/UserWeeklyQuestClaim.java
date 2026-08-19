package com.productivity.productivity.entity;

import jakarta.persistence.*;
import java.time.LocalDate;

@Entity
@Table(
        name = "user_weekly_quest_claims",
        uniqueConstraints = @UniqueConstraint(columnNames = {"user_id", "quest_key", "week_start"})
)
public class UserWeeklyQuestClaim {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Column(name = "quest_key", nullable = false)
    private String questKey;

    @Column(name = "week_start", nullable = false)
    private LocalDate weekStart;

    public UserWeeklyQuestClaim() {
    }

    public UserWeeklyQuestClaim(User user, String questKey, LocalDate weekStart) {
        this.user = user;
        this.questKey = questKey;
        this.weekStart = weekStart;
    }

    public Long getId() { return id; }
    public User getUser() { return user; }
    public String getQuestKey() { return questKey; }
    public LocalDate getWeekStart() { return weekStart; }
    public void setUser(User user) { this.user = user; }
    public void setQuestKey(String questKey) { this.questKey = questKey; }
    public void setWeekStart(LocalDate weekStart) { this.weekStart = weekStart; }
}
