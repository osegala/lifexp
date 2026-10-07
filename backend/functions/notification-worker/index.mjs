import { createHash } from "node:crypto";
import { DynamoDBClient, GetItemCommand, QueryCommand, UpdateItemCommand, TransactWriteItemsCommand } from "@aws-sdk/client-dynamodb";
import { preferencesFromItem } from "/opt/nodejs/preferences.mjs";
import { planNotifications } from "/opt/nodejs/planning.mjs";
import { advanceRequest, claimRequest, deliveryRecord, dueQueryRequest, releaseClaimRequest } from "./logic.mjs";
import { createExpoProvider, deliveryMode } from "./push-provider.mjs";

const client = new DynamoDBClient({});
const TABLE_NAME = process.env.TABLE_NAME;
const BATCH_SIZE = Math.min(100, Math.max(1, Number(process.env.NOTIFICATION_BATCH_SIZE ?? 25)));
const provider = createExpoProvider({ mode: deliveryMode() });
const getItem = async key => (await client.send(new GetItemCommand({ TableName: TABLE_NAME, Key: key, ConsistentRead: true }))).Item;

async function queryPrefix(pk, prefix) {
    const items = [];
    let ExclusiveStartKey;
    do {
        const page = await client.send(new QueryCommand({ TableName: TABLE_NAME,
            KeyConditionExpression: "PK = :pk AND begins_with(SK, :prefix)",
            ExpressionAttributeValues: { ":pk": { S: pk }, ":prefix": { S: prefix } }, ConsistentRead: true, ExclusiveStartKey }));
        items.push(...(page.Items ?? []));
        ExclusiveStartKey = page.LastEvaluatedKey;
    } while (ExclusiveStartKey);
    return items;
}

function unchanged(key, item, fields = ["updatedAt"]) {
    const names = {}, values = {};
    const conditions = [item ? "attribute_exists(PK)" : "attribute_not_exists(PK)"];
    for (const field of fields) {
        names[`#${field}`] = field;
        if (item?.[field]) { values[`:${field}`] = item[field]; conditions.push(`#${field} = :${field}`); }
        else conditions.push(`attribute_not_exists(#${field})`);
    }
    return { ConditionCheck: { TableName: TABLE_NAME, Key: key, ConditionExpression: conditions.join(" AND "),
        ExpressionAttributeNames: names, ...(Object.keys(values).length ? { ExpressionAttributeValues: values } : {}) } };
}

async function setStatus(item, result) {
    await client.send(new UpdateItemCommand({ TableName: TABLE_NAME, Key: { PK: item.PK, SK: item.SK },
        ConditionExpression: "attribute_exists(PK)",
        UpdateExpression: "SET #status = :status, errorCode = :error", ExpressionAttributeNames: { "#status": "status" },
        ExpressionAttributeValues: { ":status": { S: result.status }, ":error": { S: result.errorCode ?? "" } } }));
}

async function processDue(indexItem, now) {
    let config;
    const dueKey = indexItem.GSI1SK.S;
    try {
        config = (await client.send(new UpdateItemCommand(claimRequest(TABLE_NAME, indexItem, now.toISOString())))).Attributes;
    } catch (error) {
        if (error.name === "ConditionalCheckFailedException") return "ALREADY_CLAIMED";
        throw error;
    }
    try {
        const pk = config.PK.S;
        const key = sk => ({ PK: config.PK, SK: { S: sk } });
        const daily = config.SK.S === "PREFERENCES";
        const [profile, preferenceItem, task, devices, tasks, stats] = await Promise.all([
            getItem(key("PROFILE")), daily ? Promise.resolve(config) : getItem(key("PREFERENCES")),
            daily ? null : getItem(key(`TASK#${config.taskId?.S}`)), queryPrefix(pk, "DEVICE#"),
            daily ? queryPrefix(pk, "TASK#") : [], daily ? queryPrefix(pk, "STATS#DAY#") : []
        ]);
        const preferences = preferencesFromItem(preferenceItem);
        const plan = planNotifications({ config, profile, preferences, task, tasks, stats, now,
            dailyTarget: Number(process.env.DAILY_TASK_TARGET ?? 3) });
        const targets = [...new Map(devices.filter(device => device.enabled?.BOOL && device.pushToken?.S)
            .map(device => [device.pushToken.S, device])).values()];
        for (const event of plan.events) {
            const dailyStats = stats.find(stat => stat.SK.S === `STATS#DAY#${event.date}`);
            const reason = event.reason ?? (!targets.length ? "NO_ENABLED_DEVICES" : null);
            // Reserve BEFORE contacting Expo. An ambiguous network/DB response
            // must never trigger an automatic resend. This is at-most-once,
            // not guaranteed delivery: Expo has no idempotency-key contract.
            const identity = `${daily ? event.type : config.reminderId?.S}#${event.occurrence}`;
            const id = createHash("sha256").update(identity).digest("hex");
            const item = deliveryRecord({ userPk: pk, deliveryId: id, attemptedAt: now.toISOString(),
                localDate: event.date, type: event.type, config, status: reason ? "SKIPPED" : "PREPARED", errorCode: reason });
            // ONCE uses a constant date component too: timezone/edit changes
            // cannot rearm the same one-off reminder.
            item.SK = { S: `NOTIFICATION_DELIVERY#${event.occurrence}#${id}` };
            item.message = { S: event.body };
            item.scheduledAt = { S: event.at };
            item.deliveryMode = { S: provider.mode };
            const guards = [unchanged(key("PROFILE"), profile, ["timeZone"]),
                unchanged({ PK: config.PK, SK: config.SK }, config, ["updatedAt", "GSI1SK", "deliveryClaimKey"])];
            if (!daily) guards.push(unchanged(key("PREFERENCES"), preferenceItem), unchanged(key(`TASK#${config.taskId.S}`), task));
            else guards.push(unchanged(key(`STATS#DAY#${event.date}`), dailyStats, ["tasksCompleted", "goalRewarded"]));
            try {
                await client.send(new TransactWriteItemsCommand({ TransactItems: [...guards, { Put: {
                    TableName: TABLE_NAME, Item: item, ConditionExpression: "attribute_not_exists(PK) AND attribute_not_exists(SK)"
                } }] }));
            } catch (error) {
                if (error.name === "TransactionCanceledException" && await getItem({ PK: item.PK, SK: item.SK })) continue;
                throw error;
            }
            if (reason) continue;
            const results = [];
            for (const device of targets) {
                // Last opt-out/deletion check at the external boundary.
                const [freshProfile, freshPrefs, freshConfig, freshDevice, freshTask, freshStats] = await Promise.all([
                    getItem(key("PROFILE")), getItem(key("PREFERENCES")), getItem({ PK: config.PK, SK: config.SK }),
                    getItem({ PK: config.PK, SK: device.SK }), daily ? null : getItem(key(`TASK#${config.taskId.S}`)),
                    daily ? getItem(key(`STATS#DAY#${event.date}`)) : null
                ]);
                if (!freshProfile || freshProfile.timeZone?.S !== profile.timeZone?.S || !preferencesFromItem(freshPrefs).notificationsEnabled
                    || freshPrefs?.updatedAt?.S !== preferenceItem?.updatedAt?.S || freshConfig?.updatedAt?.S !== config.updatedAt?.S
                    || !freshDevice?.enabled?.BOOL || freshDevice.pushToken?.S !== device.pushToken.S
                    || (daily && (freshStats?.tasksCompleted?.N !== dailyStats?.tasksCompleted?.N || freshStats?.goalRewarded?.BOOL !== dailyStats?.goalRewarded?.BOOL))
                    || (!daily && (!freshConfig?.enabled?.BOOL || !freshTask || freshTask.archived?.BOOL || freshTask.updatedAt?.S !== task?.updatedAt?.S))) {
                    results.push({ status: "SKIPPED", errorCode: "STATE_CHANGED" }); continue;
                }
                const result = await provider.send({ token: device.pushToken.S, title: "Evrenthia", body: event.body,
                    data: { type: event.type, taskId: config.taskId?.S ?? null }, sound: preferences.soundEnabled });
                results.push(result);
                if (result.errorCode === "DeviceNotRegistered") {
                    await client.send(new UpdateItemCommand({ TableName: TABLE_NAME, Key: { PK: device.PK, SK: device.SK },
                        UpdateExpression: "SET #enabled = :false", ConditionExpression: "pushToken = :token",
                        ExpressionAttributeNames: { "#enabled": "enabled" },
                        ExpressionAttributeValues: { ":false": { BOOL: false }, ":token": device.pushToken } }));
                }
            }
            await setStatus(item, results.find(result => result.status === "FAILED")
                ?? results.find(result => result.status !== "SKIPPED") ?? results[0]);
        }
        await client.send(new UpdateItemCommand(advanceRequest(TABLE_NAME, config, dueKey, plan.schedule, now.toISOString())));
        return provider.mode;
    } catch (error) {
        try { await client.send(new UpdateItemCommand(releaseClaimRequest(TABLE_NAME, config, dueKey))); }
        catch { /* Lease expiry permits retry; durable reservations prevent resend. */ }
        throw error;
    }
}

export const handler = async (_event, context) => {
    const now = new Date();
    const due = await client.send(new QueryCommand(dueQueryRequest(TABLE_NAME, now, BATCH_SIZE)));
    const results = [];
    for (const item of due.Items ?? []) {
        try { results.push(await processDue(item, now)); }
        catch (error) {
            console.error({ level: "ERROR", event: "NOTIFICATION_OCCURRENCE_FAILED", requestId: context?.awsRequestId ?? null,
                errorName: typeof error?.name === "string" ? error.name : "Error" });
            results.push("FAILED");
        }
    }
    return { processed: results.length, results };
};
