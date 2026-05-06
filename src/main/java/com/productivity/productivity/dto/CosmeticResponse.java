package com.productivity.productivity.dto;

import com.productivity.productivity.entity.CosmeticType;

public class CosmeticResponse {
    private Long id;
    private String name;
    private CosmeticType type;
    private int requiredLevel;
    private String imageUrl;
    private boolean unlocked;
    private boolean equipped;

    public CosmeticResponse(
            Long id,
            String name,
            CosmeticType type,
            int requiredLevel,
            String imageUrl,
            boolean unlocked,
            boolean equipped
    ) {
        this.id = id;
        this.name = name;
        this.type = type;
        this.requiredLevel = requiredLevel;
        this.imageUrl = imageUrl;
        this.unlocked = unlocked;
        this.equipped = equipped;
    }

    public Long getId() { return id; }
    public String getName() { return name; }
    public CosmeticType getType() { return type; }
    public int getRequiredLevel() { return requiredLevel; }
    public String getImageUrl() { return imageUrl; }
    public boolean isUnlocked() { return unlocked; }
    public boolean isEquipped() { return equipped; }
}