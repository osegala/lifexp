package com.productivity.productivity.entity;

import jakarta.persistence.*;

@Entity
@Table(name = "avatars")
public class Avatar {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private String baseStyle = "DEFAULT";

    private String bodyType = "BOY";

    private Long equippedHairId;
    private Long equippedHatId;
    private Long equippedTopId;
    private Long equippedBottomId;
    private Long equippedBootsId;
    private Long equippedCapeId;
    private Long equippedWeaponId;
    private Long equippedShieldId;
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
    public String getBodyType() { return bodyType; }
    public Long getEquippedHairId() { return equippedHairId; }
    public Long getEquippedHatId() { return equippedHatId; }
    public Long getEquippedTopId() { return equippedTopId; }
    public Long getEquippedBottomId() { return equippedBottomId; }
    public Long getEquippedBootsId() { return equippedBootsId; }
    public Long getEquippedCapeId() { return equippedCapeId; }
    public Long getEquippedWeaponId() { return equippedWeaponId; }
    public Long getEquippedShieldId() { return equippedShieldId; }
    public Long getEquippedBackgroundId() { return equippedBackgroundId; }
    public Long getEquippedPetId() { return equippedPetId; }
    public Long getEquippedAuraId() { return equippedAuraId; }
    public User getUser() { return user; }

    public void setBaseStyle(String baseStyle) { this.baseStyle = baseStyle; }
    public void setBodyType(String bodyType) { this.bodyType = bodyType; }
    public void setEquippedHairId(Long equippedHairId) { this.equippedHairId = equippedHairId; }
    public void setEquippedHatId(Long equippedHatId) { this.equippedHatId = equippedHatId; }
    public void setEquippedTopId(Long equippedTopId) { this.equippedTopId = equippedTopId; }
    public void setEquippedBottomId(Long equippedBottomId) { this.equippedBottomId = equippedBottomId; }
    public void setEquippedBootsId(Long equippedBootsId) { this.equippedBootsId = equippedBootsId; }
    public void setEquippedCapeId(Long equippedCapeId) { this.equippedCapeId = equippedCapeId; }
    public void setEquippedWeaponId(Long equippedWeaponId) { this.equippedWeaponId = equippedWeaponId; }
    public void setEquippedShieldId(Long equippedShieldId) { this.equippedShieldId = equippedShieldId; }
    public void setEquippedBackgroundId(Long equippedBackgroundId) { this.equippedBackgroundId = equippedBackgroundId; }
    public void setEquippedPetId(Long equippedPetId) { this.equippedPetId = equippedPetId; }
    public void setEquippedAuraId(Long equippedAuraId) { this.equippedAuraId = equippedAuraId; }
    public void setUser(User user) { this.user = user; }
}
