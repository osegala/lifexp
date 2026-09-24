export class PurchaseError extends Error {
    constructor(statusCode, code, message, details) {
        super(message);
        this.statusCode = statusCode;
        this.code = code;
        this.details = details;
    }
}

export function levelFromXp(totalXp) {
    let level = 1;
    let remainingXp = Math.max(0, Number(totalXp) || 0);
    while (remainingXp >= 100 + ((level - 1) * 50)) {
        remainingXp -= 100 + ((level - 1) * 50);
        level += 1;
    }
    return level;
}

export function planPurchase(catalog, profile, {
    owned = false,
    hasRequiredAchievement = true,
    offer = null
} = {}) {
    if (!catalog) {
        throw new PurchaseError(404, "ITEM_NOT_FOUND", "Shop item not found.");
    }
    if (catalog.active === false) {
        throw new PurchaseError(400, "ITEM_LOCKED", "This item is not currently available.");
    }
    if (!profile) {
        throw new PurchaseError(404, "PROFILE_NOT_FOUND", "Player profile not found.");
    }
    if (owned) {
        throw new PurchaseError(409, "ITEM_ALREADY_OWNED", "Item is already owned.");
    }

    const catalogPrice = Number(catalog.price ?? 0);
    const requiredLevel = Number(catalog.requiredLevel ?? 1);
    const price = Number(offer?.effectivePrice ?? catalogPrice);
    const discountPercent = Number(offer?.discountPercent ?? 0);
    const effectiveRequiredLevel = Number(offer?.effectiveRequiredLevel ?? requiredLevel);
    const playerLevel = levelFromXp(profile.xp);
    if (playerLevel < effectiveRequiredLevel) {
        throw new PurchaseError(403, "ITEM_LOCKED", "Required level not reached.", {
            requiredLevel,
            effectiveRequiredLevel,
            playerLevel
        });
    }
    if (catalog.requiredAchievement && !hasRequiredAchievement) {
        throw new PurchaseError(403, "ITEM_LOCKED", "Required achievement not earned.", {
            requiredAchievement: catalog.requiredAchievement
        });
    }
    if (Number(profile.coins ?? 0) < price) {
        throw new PurchaseError(400, "INSUFFICIENT_COINS", "Not enough coins.", { price, coins: Number(profile.coins ?? 0) });
    }

    return {
        price,
        catalogPrice,
        effectivePrice: price,
        discountPercent,
        requiredLevel,
        effectiveRequiredLevel,
        playerLevel,
        remainingCoins: Number(profile.coins ?? 0) - price
    };
}
