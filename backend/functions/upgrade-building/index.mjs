import {
    DynamoDBClient,
    GetItemCommand,
    QueryCommand,
    TransactWriteItemsCommand
} from "@aws-sdk/client-dynamodb";
import {
    planUpgrade,
    UpgradeError
} from "./logic.mjs";
import {
    achievementCatalogFromItem,
    achievementPut,
    achievementResponse,
    earnedAchievementIdsFromItems,
    evaluateAchievementAwards
} from "/opt/nodejs/achievements.mjs";
import {
    buildingCatalogFromItem,
    playerBuildingsFromItems,
    resolveBuildingEffects
} from "/opt/nodejs/building-effects.mjs";
import {
    authSubject,
    badRequest,
    conflict,
    errorResponse,
    handleApiError,
    internalServerError,
    jsonResponse as response,
    notFound,
    parseJsonBody,
    requiredString,
    unauthorized,
    validateBodyFields
} from "/opt/nodejs/http.mjs";

const client = new DynamoDBClient({});
const TABLE_NAME = process.env.TABLE_NAME;

async function getItem(key) {
    const result = await client.send(new GetItemCommand({
        TableName: TABLE_NAME,
        Key: key,
        ConsistentRead: true
    }));
    return result.Item;
}

async function queryPrefix(pk, prefix) {
    const items = [];
    let ExclusiveStartKey;
    do {
        const result = await client.send(new QueryCommand({
            TableName: TABLE_NAME,
            KeyConditionExpression: "PK = :pk AND begins_with(SK, :prefix)",
            ExpressionAttributeValues: {
                ":pk": { S: pk },
                ":prefix": { S: prefix }
            },
            ConsistentRead: true,
            ExclusiveStartKey
        }));
        items.push(...(result.Items ?? []));
        ExclusiveStartKey = result.LastEvaluatedKey;
    } while (ExclusiveStartKey);
    return items;
}

export const handler = async (event) => {
    const userId = authSubject(event);
    let buildingId;

    if (!userId) {
        return unauthorized();
    }
    try {
        buildingId = requiredString(event.pathParameters ?? {}, "buildingId");
    } catch (error) {
        return handleApiError(error, "Upgrade building path validation failed");
    }
    if (event.body != null) {
        try {
            validateBodyFields(parseJsonBody(event), []);
        } catch (error) {
            return handleApiError(error, "Upgrade building validation failed");
        }
    }

    try {
        const userPk = `USER#${userId}`;
        const profileKey = { PK: { S: userPk }, SK: { S: "PROFILE" } };
        const buildingKey = { PK: { S: userPk }, SK: { S: `BUILDING#${buildingId}` } };
        const [
            profile,
            buildingCatalogItems,
            playerBuildingItems,
            achievementCatalogItems,
            earnedAchievementItems
        ] = await Promise.all([
            getItem(profileKey),
            queryPrefix("CATALOG#BUILDINGS", "BUILDING#"),
            queryPrefix(userPk, "BUILDING#"),
            queryPrefix("CATALOG#ACHIEVEMENTS", "ACHIEVEMENT#"),
            queryPrefix(userPk, "ACHIEVEMENT#")
        ]);

        if (!profile) {
            return notFound("PROFILE_NOT_FOUND", "Player profile not found.");
        }

        const buildingCatalog = buildingCatalogItems.map(buildingCatalogFromItem);
        const catalog = buildingCatalog.find((entry) => entry.buildingId === buildingId) ?? null;
        const playerBuildings = playerBuildingsFromItems(playerBuildingItems);
        const building = playerBuildings.get(buildingId) ?? null;
        let plan;

        try {
            plan = planUpgrade(catalog, building, Number(profile.worldPoints?.N ?? 0));
        } catch (error) {
            if (error instanceof UpgradeError) {
                return errorResponse(error.statusCode, error.code, error.message, error.details);
            }
            throw error;
        }

        const now = new Date().toISOString();
        const before = resolveBuildingEffects(buildingCatalog, playerBuildings);
        const afterBuildings = new Map(playerBuildings);
        afterBuildings.set(buildingId, { ...building, level: plan.newLevel, upgradedAt: now });
        const after = resolveBuildingEffects(buildingCatalog, afterBuildings);
        const earnedAchievementIds = earnedAchievementIdsFromItems(earnedAchievementItems);
        const newAchievements = evaluateAchievementAwards({
            catalog: achievementCatalogItems.map(achievementCatalogFromItem),
            earnedAchievementIds,
            progress: {
                worldPoints: plan.remainingWorldPoints,
                buildingLevels: after.levels,
                totalBuildingLevels: [...after.levels.values()].reduce((sum, level) => sum + level, 0)
            },
            allowedTypes: [
                "BUILDING_LEVEL_REACHED",
                "TOTAL_BUILDING_LEVELS",
                "WORLD_POINTS_OWNED",
                "ACHIEVEMENTS_EARNED"
            ],
            now
        });
        await client.send(new TransactWriteItemsCommand({
            TransactItems: [
                {
                    Update: {
                        TableName: TABLE_NAME,
                        Key: profileKey,
                        UpdateExpression: "ADD #worldPoints :negativeCost SET #updatedAt = :now",
                        ConditionExpression: "attribute_exists(PK) AND attribute_exists(SK) AND #worldPoints = :expectedWorldPoints AND #worldPoints >= :cost",
                        ExpressionAttributeNames: {
                            "#worldPoints": "worldPoints",
                            "#updatedAt": "updatedAt"
                        },
                        ExpressionAttributeValues: {
                            ":negativeCost": { N: String(-plan.upgradeCost) },
                            ":cost": { N: String(plan.upgradeCost) },
                            ":expectedWorldPoints": profile.worldPoints ?? { N: "0" },
                            ":now": { S: now }
                        }
                    }
                },
                {
                    Update: {
                        TableName: TABLE_NAME,
                        Key: buildingKey,
                        UpdateExpression: "SET #buildingId = :buildingId, #level = :newLevel, #upgradedAt = :now",
                        ConditionExpression: "attribute_not_exists(PK) OR #level = :currentLevel",
                        ExpressionAttributeNames: {
                            "#buildingId": "buildingId",
                            "#level": "level",
                            "#upgradedAt": "upgradedAt"
                        },
                        ExpressionAttributeValues: {
                            ":buildingId": { S: buildingId },
                            ":newLevel": { N: String(plan.newLevel) },
                            ":currentLevel": { N: String(plan.currentLevel) },
                            ":now": { S: now }
                        }
                    }
                },
                ...newAchievements.map((achievement) => achievementPut(TABLE_NAME, userPk, achievement))
            ]
        }));

        return response(200, {
            upgraded: true,
            building: {
                buildingId,
                name: catalog.name,
                oldLevel: plan.currentLevel,
                newLevel: plan.newLevel,
                maxLevel: plan.maxLevel
            },
            cost: { worldPoints: plan.upgradeCost },
            player: { worldPoints: plan.remainingWorldPoints },
            effectsBefore: before.effects,
            effectsAfter: after.effects,
            newlyUnlockedAchievements: newAchievements.map(achievementResponse)
        });
    } catch (error) {
        if (error.name === "TransactionCanceledException") {
            return conflict("BUILDING_CONFLICT", "Building upgrade conflicted with another update. Please try again.");
        }
        return internalServerError("Upgrade building failed", error);
    }
};
