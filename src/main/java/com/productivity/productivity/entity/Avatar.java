package com.productivity.productivity.entity;

import jakarta.persistence.*;

@Entity
@Table(name = "avatars")
public class Avatar {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private String baseStyle = "DEFAULT";

    private Long equippedHatId;
    private Long equippedOutfitId;
    private Long equippedBackgroundId;
    private Long equippedPetId;
    private Long equippedAuraId;

    @OneToOne
    @JoinColumn(name = "user_id", nullable = false, unique = true)
    private User user;

    public Avatar() {}

    public Avatar(User user) {
        this.user = user;
    }

    public Long getId() { return id; }
    public String getBaseStyle() { return baseStyle; }
    public Long getEquippedHatId() { return equippedHatId; }
    public Long getEquippedOutfitId() { return equippedOutfitId; }
    public Long getEquippedBackgroundId() { return equippedBackgroundId; }
    public Long getEquippedPetId() { return equippedPetId; }
    public Long getEquippedAuraId() { return equippedAuraId; }
    public User getUser() { return user; }

    public void setBaseStyle(String baseStyle) { this.baseStyle = baseStyle; }
    public void setEquippedHatId(Long equippedHatId) { this.equippedHatId = equippedHatId; }
    public void setEquippedOutfitId(Long equippedOutfitId) { this.equippedOutfitId = equippedOutfitId; }
    public void setEquippedBackgroundId(Long equippedBackgroundId) { this.equippedBackgroundId = equippedBackgroundId; }
    public void setEquippedPetId(Long equippedPetId) { this.equippedPetId = equippedPetId; }
    public void setEquippedAuraId(Long equippedAuraId) { this.equippedAuraId = equippedAuraId; }
    public void setUser(User user) { this.user = user; }
}