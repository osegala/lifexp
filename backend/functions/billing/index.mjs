import { DynamoDBClient, GetItemCommand, TransactWriteItemsCommand } from "@aws-sdk/client-dynamodb";
import { ApiError, authSubject, handleApiError, jsonResponse, parseJsonBody, requireActivePlayer,
    unauthorized, validateBodyFields, validationError } from "/opt/nodejs/http.mjs";
import { billingEventKey, entitlementWrite, revenueCatConfig, verifyCustomer, webhookAuthorized } from "./revenuecat.mjs";

const client = new DynamoDBClient({});
const table = process.env.TABLE_NAME;
const read = async Key => (await client.send(new GetItemCommand({ TableName: table, Key, ConsistentRead: true }))).Item;
const key = (id, sk) => ({ PK: { S: `USER#${id}` }, SK: { S: sk } });
const supported = new Set(["INITIAL_PURCHASE", "RENEWAL", "CANCELLATION", "EXPIRATION", "UNCANCELLATION", "BILLING_ISSUE", "PRODUCT_CHANGE", "TRANSFER", "REFUND", "SUBSCRIPTION_PAUSED", "TEMPORARY_ENTITLEMENT_GRANT"]);

export const handler = async event => {
    try {
        const webhook = event.rawPath === "/webhooks/revenuecat";
        if (event.requestContext?.http?.method !== "POST") throw new ApiError(405, "METHOD_NOT_ALLOWED", "Use POST.");
        let ids, providerEvent;
        if (webhook) {
            const authorization = event.headers?.authorization ?? event.headers?.Authorization;
            if (!webhookAuthorized(authorization, process.env.REVENUECAT_WEBHOOK_AUTHORIZATION)) return unauthorized();
            providerEvent = parseJsonBody(event).event;
            if (!providerEvent || typeof providerEvent.id !== "string" || !providerEvent.id || providerEvent.id.length > 200
                || !Number.isSafeInteger(providerEvent.event_timestamp_ms) || providerEvent.event_timestamp_ms <= 0
                || providerEvent.event_timestamp_ms > Date.now() + 5 * 60_000) throw validationError("Invalid billing event.");
            if (!supported.has(providerEvent.type)) return jsonResponse(200, { ignored: true });
            if (providerEvent.type === "TRANSFER" && (!Array.isArray(providerEvent.transferred_from)
                || !Array.isArray(providerEvent.transferred_to))) throw validationError("Invalid billing identities.");
            ids = providerEvent.type === "TRANSFER" ? [...providerEvent.transferred_from, ...providerEvent.transferred_to] : [providerEvent.app_user_id];
            if (!Array.isArray(ids) || ids.length > 20) throw validationError("Invalid billing identities.");
            // Only existing Cognito-sub profiles are mutable. Anonymous RC IDs/aliases never create profiles.
            ids = [...new Set(ids.filter(id => typeof id === "string" && /^[0-9a-f-]{36}$/i.test(id)))];
        } else {
            const id = authSubject(event);
            if (!id) return unauthorized();
            validateBodyFields(parseJsonBody(event), []); // No client premium, expiry, product or identity input.
            await requireActivePlayer(event, client, table, GetItemCommand);
            ids = [id];
        }
        const config = revenueCatConfig(process.env);
        // TRANSFER may omit environment. Always re-query only the configured provider environment.
        if (webhook && ((providerEvent.environment !== config.environment.toUpperCase()
            && !(providerEvent.type === "TRANSFER" && providerEvent.environment == null))
            || (providerEvent.app_id && !config.products.some(p => p.appId === providerEvent.app_id)))) {
            throw validationError("Billing event environment/app does not match configuration.");
        }
        let result;
        for (const id of ids) {
            for (let attempt = 0; attempt < 3; attempt++) {
                if (!await read(key(id, "PROFILE"))) {
                    if (!webhook) throw new ApiError(403, "PROFILE_REQUIRED", "A player profile is required.");
                    break; // Account deletion wins over a late store callback.
                }
                const previous = await read(key(id, "ENTITLEMENTS"));
                if (providerEvent && (await read(billingEventKey(id, providerEvent.id))
                    || Number(previous?.lastRevenueCatEventAt?.N ?? 0) > providerEvent.event_timestamp_ms)) break;
                const now = new Date();
                result = await verifyCustomer(id, config, now);
                const operations = [
                    { ConditionCheck: { TableName: table, Key: key(id, "PROFILE"), ConditionExpression: "attribute_exists(PK)" } },
                    entitlementWrite(table, id, result, previous, now, providerEvent),
                ];
                if (providerEvent) operations.push({ Put: { TableName: table,
                    Item: { ...billingEventKey(id, providerEvent.id), processedAt: { S: now.toISOString() } },
                    ConditionExpression: "attribute_not_exists(PK)" } });
                try { await client.send(new TransactWriteItemsCommand({ TransactItems: operations })); break; }
                catch (error) {
                    if (!["TransactionCanceledException", "TransactionConflictException"].includes(error.name)) throw error;
                    if (attempt === 2) throw new ApiError(409, "BILLING_CONFLICT", "Verification conflicted. Please retry.");
                    // Re-fetch provider state after any concurrent mutation; never replay a stale snapshot.
                }
            }
        }
        return jsonResponse(200, webhook ? { received: true } : result);
    } catch (error) { return handleApiError(error, "Billing verification failed"); }
};
