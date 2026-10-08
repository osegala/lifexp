import { DynamoDBClient, GetItemCommand, TransactWriteItemsCommand } from "@aws-sdk/client-dynamodb";
import { ApiError, authSubject, handleApiError, jsonResponse, parseJsonBody, requireActivePlayer,
    requiredString, unauthorized, validateBodyFields, validationError } from "/opt/nodejs/http.mjs";
import { effectiveEntitlement, entitlementFromItem, shouldShowAds } from "/opt/nodejs/entitlements.mjs";
import { localDate } from "/opt/nodejs/dates.mjs";
import { dailyRewardKey, entitlementCondition, rewardStatus, rewardTransaction } from "./logic.mjs";
import { receiptKey, rewardVerifier } from "./verification.mjs";
import { admobVerifier, transactionKey } from "./admob.mjs";

const client = new DynamoDBClient({});
const TABLE_NAME = process.env.TABLE_NAME;
const verifier = rewardVerifier(process.env.ENVIRONMENT_NAME, process.env.DEV_REWARDED_ADS_ENABLED);
const admob = admobVerifier(process.env);
const read = async key => (await client.send(new GetItemCommand({ TableName: TABLE_NAME, Key: key, ConsistentRead: true }))).Item;

export const handler = async event => {
    let userId = authSubject(event);
    const callback = event.rawPath === "/webhooks/admob/reward";
    if (!callback && !userId) return unauthorized();
    try {
        const method = event.requestContext?.http?.method;
        if (callback && method !== "GET") throw new ApiError(405, "METHOD_NOT_ALLOWED", "Use GET.");
        const verified = callback ? await admob.verifyCallback(event.rawQueryString, new Date()) : null;
        if (verified) userId = verified.userId;
        // The callback's authenticated claim supplies identity; no request header/JWT can override it.
        const playerEvent = callback ? { requestContext: { authorizer: { jwt: { claims: { sub: userId } } } } } : event;
        const preparing = event.rawPath === "/ads/reward/prepare" && method === "POST";
        if (!preparing && !["GET", "POST"].includes(method)) throw new ApiError(405, "METHOD_NOT_ALLOWED", "Unsupported ad operation.");
        let eventId = verified?.eventId ?? event.queryStringParameters?.claimId;
        let provider = callback || event.queryStringParameters?.provider === "ADMOB" || eventId?.startsWith("adm:") ? "ADMOB" : "DEV_TEST", platform;
        if (method === "POST") {
            const body = validateBodyFields(parseJsonBody(event), preparing ? ["provider", "platform"] : ["providerEventId", "rewardType"]);
            if (preparing && Object.keys(body).length) {
                if (body.provider !== "ADMOB" || !["IOS", "ANDROID"].includes(body.platform)) throw validationError("Invalid ad provider/platform.");
                provider = "ADMOB"; platform = body.platform;
            }
            if (!preparing) {
                eventId = requiredString(body, "providerEventId", 160);
                if (body.rewardType !== "COINS") throw validationError("rewardType must be COINS.");
            }
        }
        for (let attempt = 0; attempt < 3; attempt++) {
            const { profile } = callback ? await requireActivePlayer(playerEvent, client, TABLE_NAME, GetItemCommand)
                : await requireActivePlayer(event, client, TABLE_NAME, GetItemCommand);
            if (profile.onboardingCompleted?.BOOL === false) throw new ApiError(403, "ONBOARDING_REQUIRED", "Finish onboarding before using rewarded ads.");
            const now = new Date(), timeZone = profile.timeZone?.S ?? "UTC", date = localDate(now, timeZone);
            const entitlement = await read({ PK: { S: `USER#${userId}` }, SK: { S: "ENTITLEMENTS" } });
            if (!shouldShowAds(effectiveEntitlement(entitlementFromItem(entitlement), now))) {
                throw new ApiError(403, "REWARDED_AD_FREE_ONLY", "Rewarded ads are available only on the Free Plan.");
            }
            const daily = await read(dailyRewardKey(userId, date));
            const status = rewardStatus(profile, daily, date, timeZone, provider === "ADMOB" ? admob.available : verifier.available);
            if (method === "GET" && !callback) {
                if (!eventId) return jsonResponse(200, status);
                const receipt = admob.claim(userId, eventId, await read(receiptKey(userId, eventId)), now);
                return jsonResponse(200, { ...status, claimStatus: receipt.status.S,
                    ...(receipt.status.S === "GRANTED" ? { duplicate: false, originalGrantDate: receipt.grantDate.S } : {}) });
            }
            if (preparing) {
                if (!status.rewardedAdsRemainingToday) throw new ApiError(429, "AD_DAILY_LIMIT", "Daily ad rewards claimed.", status);
                const prepared = provider === "ADMOB" ? admob.prepare(userId, now, platform) : verifier.prepare(userId, now);
                await client.send(new TransactWriteItemsCommand({ TransactItems: [
                    entitlementCondition(TABLE_NAME, userId, entitlement),
                    { ConditionCheck: { TableName: TABLE_NAME, Key: { PK: { S: `USER#${userId}` }, SK: { S: "PROFILE" } },
                        ConditionExpression: "attribute_exists(PK)" } },
                    { Put: { TableName: TABLE_NAME, Item: prepared.item,
                        ConditionExpression: "attribute_not_exists(PK) AND attribute_not_exists(SK)" } }
                ] }));
                return jsonResponse(201, { providerEventId: prepared.eventId, devSimulation: provider !== "ADMOB",
                    ...(provider === "ADMOB" ? { binding: prepared.binding, adUnitId: prepared.adUnitId } : {}) });
            }
            // An authenticated client can only claim DEV simulations, never an AdMob receipt.
            const receipt = callback ? admob.claim(userId, eventId, await read(receiptKey(userId, eventId)), now)
                : verifier.verify({ userId, eventId, receipt: await read(receiptKey(userId, eventId)), now });
            if (callback && verified.adUnit !== receipt.adUnitId.S && verified.adUnit !== receipt.adUnitId.S.split("/")[1]) {
                throw new ApiError(403, "AD_COMPLETION_UNVERIFIED", "Unexpected rewarded ad unit.");
            }
            if (callback && await read(transactionKey(verified.transactionId))) return jsonResponse(200, { received: true, duplicate: true });
            if (receipt.status.S === "GRANTED") return jsonResponse(200, { ...status, duplicate: true, originalGrantDate: receipt.grantDate.S });
            if (!status.rewardedAdsRemainingToday) throw new ApiError(429, "AD_DAILY_LIMIT", "Daily ad rewards claimed.", status);
            try {
                const transaction = rewardTransaction({ tableName: TABLE_NAME, userId, profile, entitlement, receipt, daily, status, now });
                if (callback) transaction.TransactItems.push({ Put: { TableName: TABLE_NAME,
                    Item: { ...transactionKey(verified.transactionId), claimHash: { S: receipt.SK.S }, grantedAt: { S: now.toISOString() } },
                    ConditionExpression: "attribute_not_exists(PK)" } });
                await client.send(new TransactWriteItemsCommand(transaction));
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
