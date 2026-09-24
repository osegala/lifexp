export const ACHIEVEMENT_TYPES = Object.freeze([
    "TASKS_COMPLETED",
    "LEVEL_REACHED",
    "COINS_OWNED",
    "STREAK_REACHED",
    "WORLD_POINTS_OWNED",
    "BUILDING_LEVEL_REACHED",
    "TOTAL_BUILDING_LEVELS",
    "COSMETICS_OWNED",
    "ACHIEVEMENTS_EARNED",
    "DAILY_GOALS_COMPLETED"
]);

const SUPPORTED_TYPES = new Set(ACHIEVEMENT_TYPES);

function buildingLevel(buildingLevels, buildingId) {
    if (!buildingId) return 0;
    if (buildingLevels instanceof Map) {
        return buildingLevels.has(buildingId) ? Number(buildingLevels.get(buildingId)) : 0;
    }
    return Object.hasOwn(buildingLevels ?? {}, buildingId) ? Number(buildingLevels[buildingId]) : 0;
}

export function achievementProgress(achievement, progress) {
    switch (achievement.type) {
        case "TASKS_COMPLETED": return Number(progress.tasksCompleted ?? 0);
        case "LEVEL_REACHED": return Number(progress.level ?? 1);
        case "COINS_OWNED": return Number(progress.coins ?? 0);
        case "STREAK_REACHED": return Number(progress.streak ?? 0);
        case "WORLD_POINTS_OWNED": return Number(progress.worldPoints ?? 0);
        case "BUILDING_LEVEL_REACHED": return buildingLevel(progress.buildingLevels, achievement.targetBuildingId);
        case "TOTAL_BUILDING_LEVELS": return Number(progress.totalBuildingLevels ?? 0);
        case "COSMETICS_OWNED": return Number(progress.cosmeticsOwned ?? 0);
        case "ACHIEVEMENTS_EARNED": return Number(progress.achievementsEarned ?? 0);
        case "DAILY_GOALS_COMPLETED": return Number(progress.dailyGoalsCompleted ?? 0);
        default: return null;
    }
}

export function dailyGoalCompletionCount(items = [], awardedDate = null) {
    // ponytail: persisted day records stay authoritative; add a conditional aggregate only if history volume becomes a measured bottleneck.
    const dates = new Set();
    for (const item of items) {
        const rewarded = item.goalRewarded?.BOOL ?? item.goalRewarded;
        const date = item.date?.S ?? item.date ?? item.SK?.S?.slice("STATS#DAY#".length);
        if (rewarded === true && date) dates.add(date);
    }
    if (awardedDate) dates.add(awardedDate);
    return dates.size;
}

export function evaluateAchievementAwards({
    catalog,
    earnedAchievementIds = new Set(),
    progress,
    allowedTypes = ACHIEVEMENT_TYPES,
    now
}) {
    const allowed = new Set(allowedTypes);
    const earned = new Set(earnedAchievementIds);
    const candidates = catalog
        .filter((achievement) =>
            achievement.active === true &&
            achievement.achievementId &&
            SUPPORTED_TYPES.has(achievement.type) &&
            allowed.has(achievement.type)
        )
        .sort((left, right) =>
            Number(left.sortOrder ?? 0) - Number(right.sortOrder ?? 0) ||
            left.achievementId.localeCompare(right.achievementId)
        );
    const awards = [];

    // Each successful pass adds at least one ID, so this finite bound cannot loop forever.
    for (let pass = 0; pass <= candidates.length; pass++) {
        const passProgress = { ...progress, achievementsEarned: earned.size };
        const eligible = candidates.filter((achievement) => {
            const value = achievementProgress(achievement, passProgress);
            return !earned.has(achievement.achievementId) &&
                value !== null &&
                value >= Number(achievement.requiredValue ?? 0);
        });
        if (!eligible.length) break;

        for (const achievement of eligible) {
            if (earned.has(achievement.achievementId)) continue;
            const progressValue = achievementProgress(achievement, passProgress);
            earned.add(achievement.achievementId);
            awards.push({ ...achievement, progressValue, earnedAt: now });
        }
    }

    return awards;
}

function numberFrom(attribute, fallback = 0) {
    const number = Number(attribute?.N ?? fallback);
    return Number.isFinite(number) ? number : fallback;
}

export function achievementCatalogFromItem(item) {
    return {
        achievementId: item.achievementId?.S ?? item.SK?.S?.slice("ACHIEVEMENT#".length) ?? "",
        name: item.name?.S ?? "",
        description: item.description?.S ?? "",
        type: item.type?.S ?? "UNKNOWN",
        requiredValue: numberFrom(item.requiredValue),
        targetBuildingId: item.targetBuildingId?.S ?? null,
        active: item.active?.BOOL === true,
        sortOrder: numberFrom(item.sortOrder)
    };
}

export function earnedAchievementIdsFromItems(items = []) {
    return new Set(items.map((item) =>
        item.achievementId?.S ?? item.SK?.S?.slice("ACHIEVEMENT#".length)
    ).filter(Boolean));
}

export function achievementPut(tableName, userPk, achievement) {
    return {
        Put: {
            TableName: tableName,
            Item: {
                PK: { S: userPk },
                SK: { S: `ACHIEVEMENT#${achievement.achievementId}` },
                achievementId: { S: achievement.achievementId },
                earnedAt: { S: achievement.earnedAt },
                type: { S: achievement.type },
                progressValue: { N: String(achievement.progressValue) }
            },
            ConditionExpression: "attribute_not_exists(PK) AND attribute_not_exists(SK)"
        }
    };
}

export function achievementResponse(achievement) {
    return {
        achievementId: achievement.achievementId,
        name: achievement.name,
        description: achievement.description,
        type: achievement.type,
        requiredValue: achievement.requiredValue,
        progressValue: achievement.progressValue,
        earnedAt: achievement.earnedAt,
        ...(achievement.targetBuildingId ? { targetBuildingId: achievement.targetBuildingId } : {})
    };
}
