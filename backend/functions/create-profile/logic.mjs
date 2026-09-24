const DISPLAY_NAME_ATTRIBUTES = [
    "custom:displayName",
    "custom:display_name",
    "preferred_username",
    "name",
    "nickname",
    "given_name"
];

export function displayNameFrom(attributes = {}) {
    for (const key of DISPLAY_NAME_ATTRIBUTES) {
        const value = attributes[key];
        if (typeof value === "string" && value.trim()) {
            return value.trim();
        }
    }
    return "Adventurer";
}

export function profilePutRequest(tableName, event, now = new Date().toISOString()) {
    const attributes = event?.request?.userAttributes ?? {};
    const userId = attributes.sub;
    if (!userId) {
        throw new Error("Cognito event is missing user sub");
    }

    return {
        TableName: tableName,
        Item: {
            PK: { S: `USER#${userId}` },
            SK: { S: "PROFILE" },
            displayName: { S: displayNameFrom(attributes) },
            xp: { N: "0" },
            coins: { N: "0" },
            worldPoints: { N: "0" },
            tasksCompleted: { N: "0" },
            timeZone: { S: "UTC" },
            createdAt: { S: now },
            updatedAt: { S: now }
        },
        ConditionExpression: "attribute_not_exists(PK) AND attribute_not_exists(SK)"
    };
}

export function isDuplicateProfileError(error) {
    return error?.name === "ConditionalCheckFailedException";
}
