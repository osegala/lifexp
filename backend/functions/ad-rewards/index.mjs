import { DynamoDBClient, GetItemCommand, TransactWriteItemsCommand } from "@aws-sdk/client-dynamodb";
import { ApiError, authSubject, handleApiError, jsonResponse, parseJsonBody, requireActivePlayer,
    requiredString, unauthorized, validateBodyFields, validationError } from "/opt/nodejs/http.mjs";
import { effectiveEntitlement, entitlementFromItem, shouldShowAds } from "/opt/nodejs/entitlements.mjs";
import { localDate } from "/opt/nodejs/dates.mjs";
import { dailyRewardKey, entitlementCondition, rewardStatus, rewardTransaction } from "./logic.mjs";
import { receiptKey, rewardVerifier } from "./verification.mjs";

const client = new DynamoDBClient({});
const TABLE_NAME = process.env.TABLE_NAME;
const verifier = rewardVerifier(process.env.ENVIRONMENT_NAME, process.env.DEV_REWARDED_ADS_ENABLED);
const read = async key => (await client.send(new GetItemCommand({ TableName: TABLE_NAME, Key: key, ConsistentRead: true }))).Item;

export const handler = async event => {
    const userId = authSubject(event);
    if (!userId) return unauthorized();
    try {
        const method = event.requestContext?.http?.method;
        const preparing = event.rawPath === "/ads/reward/prepare" && method === "POST";
        if (!preparing && !["GET", "POST"].includes(method)) throw new ApiError(405, "METHOD_NOT_ALLOWED", "Unsupported ad operation.");
        let eventId;
        if (method === "POST") {
            const body = validateBodyFields(parseJsonBody(event), preparing ? [] : ["providerEventId", "rewardType"]);
            if (!preparing) {
                eventId = requiredString(body, "providerEventId", 160);
                if (body.rewardType !== "COINS") throw validationError("rewardType must be COINS.");
            }
        }
        for (let attempt = 0; attempt < 3; attempt++) {
            const { profile } = await requireActivePlayer(event, client, TABLE_NAME, GetItemCommand);
            if (profile.onboardingCompleted?.BOOL === false) throw new ApiError(403, "ONBOARDING_REQUIRED", "Finish onboarding before using rewarded ads.");
            const now = new Date(), timeZone = profile.timeZone?.S ?? "UTC", date = localDate(now, timeZone);
            const entitlement = await read({ PK: { S: `USER#${userId}` }, SK: { S: "ENTITLEMENTS" } });
            if (!shouldShowAds(effectiveEntitlement(entitlementFromItem(entitlement), now))) {
                throw new ApiError(403, "REWARDED_AD_FREE_ONLY", "Rewarded ads are available only on the Free Plan.");
            }
            const daily = await read(dailyRewardKey(userId, date));
            const status = rewardStatus(profile, daily, date, timeZone, verifier.available);
            if (method === "GET") return jsonResponse(200, status);
            if (preparing) {
                if (!status.rewardedAdsRemainingToday) throw new ApiError(429, "AD_DAILY_LIMIT", "Daily ad rewards claimed.", status);
                const prepared = verifier.prepare(userId, now);
                await client.send(new TransactWriteItemsCommand({ TransactItems: [
                    entitlementCondition(TABLE_NAME, userId, entitlement),
                    { ConditionCheck: { TableName: TABLE_NAME, Key: { PK: { S: `USER#${userId}` }, SK: { S: "PROFILE" } },
                        ConditionExpression: "attribute_exists(PK)" } },
                    { Put: { TableName: TABLE_NAME, Item: prepared.item,
                        ConditionExpression: "attribute_not_exists(PK) AND attribute_not_exists(SK)" } }
                ] }));
                return jsonResponse(201, { providerEventId: prepared.eventId, devSimulation: true });
            }
            const receipt = verifier.verify({ userId, eventId, receipt: await read(receiptKey(userId, eventId)), now });
            if (receipt.status.S === "GRANTED") return jsonResponse(200, { ...status, duplicate: true, originalGrantDate: receipt.grantDate.S });
            if (!status.rewardedAdsRemainingToday) throw new ApiError(429, "AD_DAILY_LIMIT", "Daily ad rewards claimed.", status);
            try {
                await client.send(new TransactWriteItemsCommand(rewardTransaction({ tableName: TABLE_NAME, userId,
                    profile, entitlement, receipt, daily, status, now })));
                return jsonResponse(200, { ...status, coins: status.coins + status.rewardCoins,
                    rewardedAdsUsedToday: status.rewardedAdsUsedToday + 1,
                    rewardedAdsRemainingToday: status.rewardedAdsRemainingToday - 1, duplicate: false });
            } catch (error) {
                if (!["TransactionCanceledException", "TransactionConflictException"].includes(error.name)) throw error;
                // Re-read the durable receipt first on retry: a lost/duplicate success cannot grant twice.
            }
        }
        throw new ApiError(409, "AD_REWARD_CONFLICT", "Reward confirmation conflicted. Retry the same ad completion.");
    } catch (error) {
        return handleApiError(error, "Rewarded ad request failed");
    }
};
