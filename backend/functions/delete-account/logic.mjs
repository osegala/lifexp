export const MAX_BATCH_SIZE = 25;
export const MAX_UNPROCESSED_RETRIES = 4;

export function cognitoUsername(event, subject) {
    const username = event?.requestContext?.authorizer?.jwt?.claims?.["cognito:username"];
    return typeof username === "string" && username ? username : subject;
}

export function userPartitionQuery(tableName, userPk, exclusiveStartKey) {
    const request = {
        TableName: tableName,
        KeyConditionExpression: "#pk = :pk",
        ExpressionAttributeNames: { "#pk": "PK", "#sk": "SK" },
        ExpressionAttributeValues: { ":pk": { S: userPk } },
        ProjectionExpression: "#pk, #sk",
        ConsistentRead: true
    };
    if (exclusiveStartKey) request.ExclusiveStartKey = exclusiveStartKey;
    return request;
}

export function deleteBatches(tableName, userPk, items) {
    const requests = items.map((item) => {
        if (item?.PK?.S !== userPk || typeof item?.SK?.S !== "string") {
            throw new Error("User partition query returned an unexpected key.");
        }
        return { DeleteRequest: { Key: { PK: item.PK, SK: item.SK } } };
    });

    const batches = [];
    for (let index = 0; index < requests.length; index += MAX_BATCH_SIZE) {
        batches.push({ RequestItems: { [tableName]: requests.slice(index, index + MAX_BATCH_SIZE) } });
    }
    return batches;
}

export async function deleteUserPartition({
    tableName,
    userId,
    queryPage,
    writeBatch,
    sleep = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds))
}) {
    const userPk = `USER#${userId}`;
    let exclusiveStartKey;
    let deletedCount = 0;

    do {
        const page = await queryPage(userPartitionQuery(tableName, userPk, exclusiveStartKey));
        for (const batch of deleteBatches(tableName, userPk, page.Items ?? [])) {
            let pending = batch.RequestItems[tableName];
            for (let attempt = 0; pending.length; attempt++) {
                const result = await writeBatch({ RequestItems: { [tableName]: pending } });
                pending = result.UnprocessedItems?.[tableName] ?? [];
                if (!pending.length) break;
                if (attempt >= MAX_UNPROCESSED_RETRIES) {
                    throw new Error("DynamoDB account deletion retries exhausted.");
                }
                await sleep(25 * (2 ** attempt));
            }
            deletedCount += batch.RequestItems[tableName].length;
        }
        exclusiveStartKey = page.LastEvaluatedKey;
    } while (exclusiveStartKey);

    return deletedCount;
}

export async function executeAccountDeletion({ deleteApplicationData, deleteCognitoIdentity }) {
    await deleteApplicationData();
    await deleteCognitoIdentity();
}
