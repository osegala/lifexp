import { randomUUID } from "node:crypto";
import {
    DynamoDBClient,
    GetItemCommand,
    PutItemCommand,
    QueryCommand,
    UpdateItemCommand
} from "@aws-sdk/client-dynamodb";
import {
    isScheduledOccurrence,
    localDateAt,
    notificationSchedule
} from "/opt/nodejs/scheduling.mjs";
import { preferencesFromItem } from "/opt/nodejs/preferences.mjs";
import {
    advanceRequest,
    claimRequest,
    deliveryRecord,
    dueQueryRequest,
    evaluateDelivery,
    notificationType,
    releaseClaimRequest,
    schedulingConfig
} from "./logic.mjs";
import { notificationMessage } from "./messages.mjs";
import { createExpoProvider, deliveryMode } from "./push-provider.mjs";

const client = new DynamoDBClient({});
const TABLE_NAME = process.env.TABLE_NAME;
const BATCH_SIZE = Math.min(100, Math.max(1, Number(process.env.NOTIFICATION_BATCH_SIZE ?? 25)));
const provider = createExpoProvider({ mode: deliveryMode() });

const getItem = async (key) => (await client.send(new GetItemCommand({
    TableName: TABLE_NAME,
    Key: key,
    ConsistentRead: true
}))).Item;

async function queryDevices(userPk) {
    const devices = [];
    let ExclusiveStartKey;
    do {
        const result = await client.send(new QueryCommand({
            TableName: TABLE_NAME,
            KeyConditionExpression: "PK = :pk AND begins_with(SK, :prefix)",
            ExpressionAttributeValues: {
                ":pk": { S: userPk },
                ":prefix": { S: "DEVICE#" }
            },
            ExclusiveStartKey
        }));
        devices.push(...(result.Items ?? []));
        ExclusiveStartKey = result.LastEvaluatedKey;
    } while (ExclusiveStartKey);
    return devices;
}

async function updateDeliveryStatus(item, result) {
    if (result.status === "PREPARED") return;
    const names = { "#status": "status" };
    const values = { ":status": { S: result.status } };
    const set = ["#status = :status"];
    const remove = [];
    names["#errorCode"] = "errorCode";
    if (result.errorCode) {
        values[":errorCode"] = { S: result.errorCode };
        set.push("#errorCode = :errorCode");
    } else {
        remove.push("#errorCode");
    }
    await client.send(new UpdateItemCommand({
        TableName: TABLE_NAME,
        Key: { PK: item.PK, SK: item.SK },
        UpdateExpression: [`SET ${set.join(", ")}`, remove.length ? `REMOVE ${remove.join(", ")}` : ""]
            .filter(Boolean).join(" "),
        ExpressionAttributeNames: names,
        ExpressionAttributeValues: values
    }));
}

async function processDue(indexItem, now) {
    const dueKey = indexItem.GSI1SK.S;
    let config;
    try {
        const claim = await client.send(new UpdateItemCommand(claimRequest(
            TABLE_NAME,
            indexItem,
            now.toISOString()
        )));
        config = claim.Attributes;
    } catch (error) {
        if (error.name === "ConditionalCheckFailedException") return "ALREADY_CLAIMED";
        throw error;
    }

    try {
        const type = notificationType(config);
        const userPk = config.PK.S;
        const [profile, preferences, task, devices] = await Promise.all([
            getItem({ PK: config.PK, SK: { S: "PROFILE" } }),
            type === "TASK" ? getItem({ PK: config.PK, SK: { S: "PREFERENCES" } }) : Promise.resolve(config),
            type === "TASK" && config.taskId?.S
                ? getItem({ PK: config.PK, SK: { S: `TASK#${config.taskId.S}` } })
                : Promise.resolve(null),
            queryDevices(userPk)
        ]);
        const resolvedPreferences = preferencesFromItem(preferences);
        const scheduleConfig = schedulingConfig(config, profile, resolvedPreferences);
        const occurrenceValid = Boolean(scheduleConfig)
            && isScheduledOccurrence(config.nextDueAt?.S, scheduleConfig);
        const decision = evaluateDelivery({
            config,
            preferences: resolvedPreferences,
            task,
            devices,
            occurrenceValid,
            now
        });
        const nextSchedule = scheduleConfig
            ? notificationSchedule(scheduleConfig, now)
            : null;
        const attemptedAt = now.toISOString();
        const localDate = profile ? localDateAt(now, profile.timeZone?.S ?? "UTC") : null;
        const message = notificationMessage(type, task?.title?.S);
        const targets = decision.deliver ? decision.devices : [null];
        const records = targets.map((device) => ({
            device,
            item: deliveryRecord({
                userPk,
                deliveryId: randomUUID(),
                attemptedAt,
                localDate,
                type: type ?? "UNKNOWN",
                config,
                device,
                status: decision.deliver ? "PREPARED" : "SKIPPED",
                errorCode: decision.reason
            })
        }));

        await Promise.all(records.map(({ item }) => client.send(new PutItemCommand({
            TableName: TABLE_NAME,
            Item: item,
            ConditionExpression: "attribute_not_exists(PK) AND attribute_not_exists(SK)"
        }))));
        await client.send(new UpdateItemCommand(advanceRequest(
            TABLE_NAME,
            config,
            dueKey,
            nextSchedule,
            attemptedAt
        )));

        if (decision.deliver) {
            await Promise.all(records.map(async ({ device, item }) => {
                const result = await provider.send({
                    token: device.pushToken.S,
                    title: message.title,
                    body: message.body,
                    data: {
                        type,
                        reminderId: config.reminderId?.S ?? null,
                        taskId: config.taskId?.S ?? null
                    }
                });
                await updateDeliveryStatus(item, result);
            }));
        }
        return decision.deliver ? provider.mode : decision.reason;
    } catch (error) {
        try {
            await client.send(new UpdateItemCommand(releaseClaimRequest(TABLE_NAME, config, dueKey)));
        } catch {
            // A failed release is safe: the occurrence remains claimed instead of risking a duplicate delivery.
        }
        throw error;
    }
}

export const handler = async (_event, context) => {
    const now = new Date();
    const due = await client.send(new QueryCommand(dueQueryRequest(TABLE_NAME, now, BATCH_SIZE)));
    const results = [];
    for (const item of due.Items ?? []) {
        try {
            results.push(await processDue(item, now));
        } catch (error) {
            console.error({
                level: "ERROR",
                event: "NOTIFICATION_OCCURRENCE_FAILED",
                function: process.env.AWS_LAMBDA_FUNCTION_NAME ?? "unknown",
                requestId: context?.awsRequestId ?? null,
                message: "Notification occurrence failed.",
                errorName: typeof error?.name === "string" ? error.name : "Error"
            });
            results.push("FAILED");
        }
    }
    return { processed: results.length, results };
};
