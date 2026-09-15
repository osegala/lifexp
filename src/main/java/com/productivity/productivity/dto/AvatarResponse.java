package com.productivity.productivity.dto;

public class AvatarResponse {
    private Long id;
    private String baseStyle;
    private String bodyType;
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

    public AvatarResponse(
            Long id,
            String baseStyle,
            String bodyType,
            Long equippedHairId,
            Long equippedHatId,
            Long equippedTopId,
            Long equippedBottomId,
            Long equippedBootsId,
            Long equippedCapeId,
            Long equippedWeaponId,
            Long equippedShieldId,
            Long equippedBackgroundId,
            Long equippedPetId,
            Long equippedAuraId
    ) {
        this.id = id;
        this.baseStyle = baseStyle;
        this.bodyType = bodyType;
        this.equippedHairId = equippedHairId;
        this.equippedHatId = equippedHatId;
        this.equippedTopId = equippedTopId;
        this.equippedBottomId = equippedBottomId;
        this.equippedBootsId = equippedBootsId;
        this.equippedCapeId = equippedCapeId;
        this.equippedWeaponId = equippedWeaponId;
        this.equippedShieldId = equippedShieldId;
        this.equippedBackgroundId = equippedBackgroundId;
        this.equippedPetId = equippedPetId;
        this.equippedAuraId = equippedAuraId;
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
}
