package com.productivity.productivity.dto;

public class SubscriptionResponse {
    private final boolean premiumActive;
    private final boolean active;
    private final String entitlement;
    private final String provider;
    private final String title;
    private final String description;
    private final double xpMultiplier;

    public SubscriptionResponse(
            boolean premiumActive,
            String entitlement,
            String provider,
            String title,
            String description,
            double xpMultiplier
    ) {
        this.premiumActive = premiumActive;
        this.active = premiumActive;
        this.entitlement = entitlement;
        this.provider = provider;
        this.title = title;
        this.description = description;
        this.xpMultiplier = xpMultiplier;
    }

    public boolean isPremiumActive() { return premiumActive; }
    public boolean isActive() { return active; }
    public String getEntitlement() { return entitlement; }
    public String getProvider() { return provider; }
    public String getTitle() { return title; }
    public String getDescription() { return description; }
    public double getXpMultiplier() { return xpMultiplier; }
}
