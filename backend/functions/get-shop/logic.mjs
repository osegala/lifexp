export function levelFromXp(totalXp) {
    let level = 1;
    let remainingXp = Math.max(0, Number(totalXp) || 0);

    while (remainingXp >= 100 + ((level - 1) * 50)) {
        remainingXp -= 100 + ((level - 1) * 50);
        level += 1;
    }
    return level;
}

export function buildShopItems(catalog, ownedIds, achievementIds, coins, level) {
    return catalog
        .filter((item) => item.active !== false)
        .map((item) => {
            const price = Number(item.price ?? 0);
            const requiredLevel = Number(item.requiredLevel ?? 1);
            const discountPercent = Number(item.discountPercent ?? 0);
            const effectivePrice = Number(item.effectivePrice ?? price);
            const effectiveRequiredLevel = Number(item.effectiveRequiredLevel ?? requiredLevel);
            const requiredAchievement = item.requiredAchievement ?? null;
            const owned = ownedIds.has(item.itemId);
            const hasLevel = level >= effectiveRequiredLevel;
            const hasAchievement = !requiredAchievement || achievementIds.has(requiredAchievement);
            const unlocked = hasLevel && hasAchievement;
            const canAfford = coins >= effectivePrice;
            const lockReasons = [];

            if (!hasLevel) {
                lockReasons.push({ type: "LEVEL", requiredLevel, effectiveRequiredLevel });
            }
            if (!hasAchievement) {
                lockReasons.push({ type: "ACHIEVEMENT", requiredAchievement });
            }

            return {
                itemId: item.itemId,
                name: item.name ?? item.itemId,
                category: item.category ?? "unknown",
                price,
                effectivePrice,
                discountPercent,
                requiredLevel,
                effectiveRequiredLevel,
                requiredAchievement,
                assetKey: item.assetKey ?? null,
                owned,
                unlocked,
                canAfford,
                canPurchase: !owned && unlocked && canAfford,
                status: owned
                    ? "OWNED"
                    : !unlocked
                        ? "LOCKED"
                        : !canAfford
                            ? "NOT_ENOUGH_COINS"
                            : "PURCHASABLE",
                lockReasons,
                sortOrder: Number(item.sortOrder ?? 0)
            };
        })
        .sort((a, b) => a.sortOrder - b.sortOrder);
}
