export function archiveTaskRequest(tableName, key, now) {
    return {
        TableName: tableName,
        Key: key,
        UpdateExpression: "SET #archived = :true, #archivedAt = if_not_exists(#archivedAt, :now), #active = :false, #updatedAt = :now",
        ConditionExpression: "attribute_exists(PK) AND attribute_exists(SK)",
        ExpressionAttributeNames: {
            "#archived": "archived",
            "#archivedAt": "archivedAt",
            "#active": "active",
            "#updatedAt": "updatedAt"
        },
        ExpressionAttributeValues: {
            ":true": { BOOL: true },
            ":false": { BOOL: false },
            ":now": { S: now }
        }
    };
}
