export const REWARDED_AD_COINS = 10;
export const REWARDED_AD_DAILY_LIMIT = 3;

export const dailyRewardKey = (userId, date) => ({ PK: { S: `USER#${userId}` }, SK: { S: `AD_REWARDS#DAY#${date}` } });

export function rewardStatus(profile, daily, date, timeZone, available) {
    const used = Number(daily?.used?.N ?? 0);
    const coins = Number(profile.coins?.N ?? 0);
    if (!Number.isSafeInteger(used) || used < 0 || used > REWARDED_AD_DAILY_LIMIT || !Number.isSafeInteger(coins) || coins < 0) {
        throw new Error("Invalid rewarded-ad accounting state");
    }
    return { rewardCoins: REWARDED_AD_COINS, coins, rewardedAdsUsedToday: used,
        rewardedAdsRemainingToday: REWARDED_AD_DAILY_LIMIT - used, date, timeZone, available };
}

export function entitlementCondition(tableName, userId, entitlement) {
    const names = {}, values = {}, conditions = [];
    if (!entitlement) conditions.push("attribute_not_exists(PK)");
    else for (const field of ["plan", "subscriptionStatus", "expiresAt"]) {
        names[`#${field}`] = field;
        if (entitlement[field]) { values[`:${field}`] = entitlement[field]; conditions.push(`#${field} = :${field}`); }
        else conditions.push(`attribute_not_exists(#${field})`);
    }
    return { ConditionCheck: { TableName: tableName, Key: { PK: { S: `USER#${userId}` }, SK: { S: "ENTITLEMENTS" } },
        ConditionExpression: conditions.join(" AND "), ...(Object.keys(names).length ? { ExpressionAttributeNames: names } : {}),
        ...(Object.keys(values).length ? { ExpressionAttributeValues: values } : {}) } };
}

export function rewardTransaction({ tableName, userId, profile, entitlement, receipt, daily, status, now }) {
    const timeZoneCondition = profile.timeZone ? "#timeZone = :timeZone" : "attribute_not_exists(#timeZone)";
    return { TransactItems: [
        entitlementCondition(tableName, userId, entitlement),
        { Update: { TableName: tableName, Key: { PK: { S: `USER#${userId}` }, SK: { S: "PROFILE" } },
            UpdateExpression: "SET #coins = :coins, #updatedAt = :now",
            ConditionExpression: `attribute_exists(PK) AND #coins = :expectedCoins AND ${timeZoneCondition}`,
            ExpressionAttributeNames: { "#coins": "coins", "#updatedAt": "updatedAt", "#timeZone": "timeZone" },
            ExpressionAttributeValues: { ":coins": { N: String(status.coins + REWARDED_AD_COINS) },
                ":expectedCoins": profile.coins, ":now": { S: now.toISOString() },
                ...(profile.timeZone ? { ":timeZone": profile.timeZone } : {}) } } },
        { Update: { TableName: tableName, Key: dailyRewardKey(userId, status.date),
            UpdateExpression: "SET #used = :next, #updatedAt = :now",
            ConditionExpression: daily ? "#used = :expected AND #used < :limit" : "attribute_not_exists(PK)",
            ExpressionAttributeNames: { "#used": "used", "#updatedAt": "updatedAt" },
            ExpressionAttributeValues: { ":next": { N: String(status.rewardedAdsUsedToday + 1) }, ":now": { S: now.toISOString() },
                ...(daily ? { ":expected": daily.used, ":limit": { N: String(REWARDED_AD_DAILY_LIMIT) } } : {}) } } },
        { Update: { TableName: tableName, Key: { PK: receipt.PK, SK: receipt.SK },
            UpdateExpression: "SET #status = :granted, #date = :date, #grantedAt = :now",
            ConditionExpression: "#status = :ready AND #expiresAt > :now",
            ExpressionAttributeNames: { "#status": "status", "#date": "grantDate", "#grantedAt": "grantedAt", "#expiresAt": "expiresAt" },
            ExpressionAttributeValues: { ":granted": { S: "GRANTED" }, ":ready": { S: "READY" },
                ":date": { S: status.date }, ":now": { S: now.toISOString() } } }
        }
    ] };
}
