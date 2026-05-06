package com.productivity.productivity.entity;

import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "user_cosmetics")
public class UserCosmetic {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private LocalDateTime unlockedAt = LocalDateTime.now();

    @ManyToOne
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @ManyToOne
    @JoinColumn(name = "cosmetic_id", nullable = false)
    private Cosmetic cosmetic;

    public UserCosmetic() {}

    public UserCosmetic(User user, Cosmetic cosmetic) {
        this.user = user;
        this.cosmetic = cosmetic;
    }

    public Long getId() { return id; }
    public LocalDateTime getUnlockedAt() { return unlockedAt; }
    public User getUser() { return user; }
    public Cosmetic getCosmetic() { return cosmetic; }

    public void setUnlockedAt(LocalDateTime unlockedAt) { this.unlockedAt = unlockedAt; }
    public void setUser(User user) { this.user = user; }
    public void setCosmetic(Cosmetic cosmetic) { this.cosmetic = cosmetic; }
}