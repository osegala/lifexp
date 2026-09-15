package com.productivity.productivity.dto;

import com.productivity.productivity.entity.CosmeticType;

public class ShopItemResponse {
    private final String key;
    private final Long cosmeticId;
    private final String name;
    private final CosmeticType type;
    private final String imageUrl;
    private final int priceCoins;
    private final boolean premiumOnly;
    private final boolean owned;

    public ShopItemResponse(String key, Long cosmeticId, String name, CosmeticType type, String imageUrl, int priceCoins, boolean premiumOnly, boolean owned) {
        this.key = key;
        this.cosmeticId = cosmeticId;
        this.name = name;
        this.type = type;
        this.imageUrl = imageUrl;
        this.priceCoins = priceCoins;
        this.premiumOnly = premiumOnly;
        this.owned = owned;
    }

    public String getKey() { return key; }
    public Long getCosmeticId() { return cosmeticId; }
    public String getName() { return name; }
    public CosmeticType getType() { return type; }
    public String getImageUrl() { return imageUrl; }
    public int getPriceCoins() { return priceCoins; }
    public boolean isPremiumOnly() { return premiumOnly; }
    public boolean isOwned() { return owned; }
}
