export function buildShopItems(catalog, ownedIds, achievementIds, coins, level, requirements = new Map()) {
    return catalog
        .filter((item) => item.active !== false)
        .map((item) => {
            const price = Number(item.price ?? 0);
            const requiredLevel = Number(item.requiredLevel ?? 1);
            const discountPercent = Number(item.discountPercent ?? 0);
            const effectivePrice = Number(item.effectivePrice ?? price);
            const effectiveRequiredLevel = Number(item.effectiveRequiredLevel ?? requiredLevel);
            const requiredAchievement = item.requiredAchievement ?? null;
            const requirement = requiredAchievement ? requirements.get(requiredAchievement) ?? null : null;
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
                lockReasons.push({
                    type: "ACHIEVEMENT",
                    requiredAchievement,
                    name: requirement?.name ?? requiredAchievement
                });
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
                achievementRequirement: requirement ? {
                    ...requirement,
                    progressPercent: requirement.requiredValue > 0
                        ? Math.min(100, Math.floor((requirement.currentValue / requirement.requiredValue) * 100))
                        : 0,
                    satisfied: hasAchievement
                } : null,
                requirementSatisfied: hasAchievement,
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
