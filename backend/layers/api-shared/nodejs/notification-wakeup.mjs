// Re-index existing configurations atomically with a task/timezone edit. The
// worker recomputes from authoritative data; no future reminder copies exist.
export async function notificationWakeups(client, QueryCommand, tableName, pk, now, taskId) {
    const items = [];
    let ExclusiveStartKey;
    do {
        const page = await client.send(new QueryCommand({ TableName: tableName,
            KeyConditionExpression: "PK = :pk AND begins_with(SK, :prefix)",
            ExpressionAttributeValues: { ":pk": { S: pk }, ":prefix": { S: "REMINDER#" } },
            ConsistentRead: true, ExclusiveStartKey }));
        items.push(...(page.Items ?? []).filter(item => item.enabled?.BOOL && (!taskId || item.taskId?.S === taskId)));
        ExclusiveStartKey = page.LastEvaluatedKey;
    } while (ExclusiveStartKey);
    if (items.length > 98) throw new Error("Too many reminder configurations to reschedule atomically");
    return items.map(item => ({ Update: {
        TableName: tableName, Key: { PK: item.PK, SK: item.SK },
        UpdateExpression: "SET GSI1PK = :partition, GSI1SK = :sort",
        ConditionExpression: "#enabled = :true AND #updated = :updated",
        ExpressionAttributeNames: { "#enabled": "enabled", "#updated": "updatedAt" },
        ExpressionAttributeValues: { ":partition": { S: "NOTIFICATION_DUE" }, ":sort": { S: `${now}#${item.SK.S}` },
            ":true": { BOOL: true }, ":updated": item.updatedAt }
    } }));
}
