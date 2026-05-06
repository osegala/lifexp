package com.productivity.productivity.dto;

public class AvatarResponse {
    private Long id;
    private String baseStyle;
    private Long equippedHatId;
    private Long equippedOutfitId;
    private Long equippedBackgroundId;
    private Long equippedPetId;
    private Long equippedAuraId;

    public AvatarResponse(Long id, String baseStyle, Long equippedHatId, Long equippedOutfitId, Long equippedBackgroundId, Long equippedPetId, Long equippedAuraId) {
        this.id = id;
        this.baseStyle = baseStyle;
        this.equippedHatId = equippedHatId;
        this.equippedOutfitId = equippedOutfitId;
        this.equippedBackgroundId = equippedBackgroundId;
        this.equippedPetId = equippedPetId;
        this.equippedAuraId = equippedAuraId;
    }

    public Long getId() { return id; }
    public String getBaseStyle() { return baseStyle; }
    public Long getEquippedHatId() { return equippedHatId; }
    public Long getEquippedOutfitId() { return equippedOutfitId; }
    public Long getEquippedBackgroundId() { return equippedBackgroundId; }
    public Long getEquippedPetId() { return equippedPetId; }
    public Long getEquippedAuraId() { return equippedAuraId; }
}