package com.productivity.productivity.entity;

import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(
        name = "user_achievement_claims",
        uniqueConstraints = @UniqueConstraint(columnNames = {"user_id", "achievement_key"})
)
public class UserAchievementClaim {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Column(name = "achievement_key", nullable = false)
    private String achievementKey;

    @Column(nullable = false)
    private LocalDateTime claimedAt = LocalDateTime.now();

    public UserAchievementClaim() {
    }

    public UserAchievementClaim(User user, String achievementKey) {
        this.user = user;
        this.achievementKey = achievementKey;
    }

    public Long getId() { return id; }
    public User getUser() { return user; }
    public String getAchievementKey() { return achievementKey; }
    public LocalDateTime getClaimedAt() { return claimedAt; }
    public void setUser(User user) { this.user = user; }
    public void setAchievementKey(String achievementKey) { this.achievementKey = achievementKey; }
    public void setClaimedAt(LocalDateTime claimedAt) { this.claimedAt = claimedAt; }
}
