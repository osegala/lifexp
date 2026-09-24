export function levelInfo(totalXp) {
    let level = 1;
    let xpIntoLevel = totalXp;

    while (xpIntoLevel >= 100 + ((level - 1) * 50)) {
        xpIntoLevel -= 100 + ((level - 1) * 50);
        level++;
    }

    const xpForNextLevel = 100 + ((level - 1) * 50);
    return {
        level,
        xpIntoLevel,
        xpForNextLevel,
        xpToNextLevel: xpForNextLevel - xpIntoLevel
    };
}

export function buildAchievements(catalog, earnedById) {
    return catalog
        .filter((achievement) => achievement.active)
        .map((achievement) => {
            const currentValue = achievement.currentValue ?? 0;
            const earnedRecord = earnedById.get(achievement.achievementId);
            return {
                achievementId: achievement.achievementId,
                name: achievement.name || achievement.achievementId || "Achievement",
                description: achievement.description,
                type: achievement.type || "UNKNOWN",
                supported: achievement.supported !== false,
                requiredValue: achievement.requiredValue,
                currentValue,
                remaining: Math.max(0, achievement.requiredValue - currentValue),
                progressPercent: achievement.requiredValue > 0
                    ? Math.min(100, Math.floor((currentValue / achievement.requiredValue) * 100))
                    : 0,
                earned: Boolean(earnedRecord),
                earnedAt: earnedRecord?.earnedAt ?? null,
                progressValueAtEarn: earnedRecord?.progressValue ?? null,
                sortOrder: achievement.sortOrder,
                ...(achievement.targetBuildingId
                    ? { targetBuildingId: achievement.targetBuildingId }
                    : {})
            };
        })
        .sort((left, right) =>
            left.sortOrder - right.sortOrder ||
            String(left.achievementId ?? "").localeCompare(String(right.achievementId ?? ""))
        );
}

export function achievementSummary(achievements) {
    const earned = achievements.filter((achievement) => achievement.earned).length;
    const byType = {};

    for (const achievement of achievements) {
        byType[achievement.type] ??= { earned: 0, total: 0 };
        byType[achievement.type].total++;
        if (achievement.earned) {
            byType[achievement.type].earned++;
        }
    }

    return {
        earned,
        locked: achievements.length - earned,
        total: achievements.length,
        completionPercent: achievements.length > 0
            ? Math.floor((earned / achievements.length) * 100)
            : 0,
        byType
    };
}
