import { createHash, randomUUID } from "node:crypto";
import {
    DynamoDBClient,
    GetItemCommand,
    PutItemCommand
} from "@aws-sdk/client-dynamodb";
import {
    authSubject,
    conflict,
    handleApiError,
    internalServerError,
    jsonResponse as response,
    parseJsonBody,
    requireActivePlayer,
    unauthorized
} from "/opt/nodejs/http.mjs";
import { validateTaskCreate } from "/opt/nodejs/task-input.mjs";
import { rewardForTaskSize } from "/opt/nodejs/task-rewards.mjs";
import { localDate } from "/opt/nodejs/dates.mjs";

const client = new DynamoDBClient({});
const TABLE_NAME = process.env.TABLE_NAME;
export const handler = async (event) => {
    const userId = authSubject(event);
    if (!userId) {
        return unauthorized();
    }
    let profile;
    try {
        ({ profile } = await requireActivePlayer(event, client, TABLE_NAME, GetItemCommand));
    } catch (error) {
        return handleApiError(error, "Create task active player check failed");
    }

    let input;
    try {
        input = validateTaskCreate(parseJsonBody(event));
    } catch (error) {
        return handleApiError(error, "Create task validation failed");
    }

    // An optional retry key reuses this user's task record, including after a lost response.
    const taskId = input.clientRequestId
        ? createHash("sha256").update(`${userId}:${input.clientRequestId}`).digest("hex")
        : randomUUID();
    const requestHash = createHash("sha256").update(JSON.stringify(input)).digest("hex");
    const now = new Date().toISOString();
    const { repeatType, repeatDays } = input;
    const startDate = input.startDate ?? (repeatType !== "NONE"
        ? localDate(new Date(now), profile.timeZone?.S ?? "UTC") : null);
    const reward = rewardForTaskSize(input.taskSize);
    const userPk = `USER#${userId}`;
    const item = {
        PK: { S: userPk },
        SK: { S: `TASK#${taskId}` },
        entityType: { S: "TASK" },
        taskId: { S: taskId },
        title: { S: input.title },
        taskSize: { S: input.taskSize },
        repeatType: { S: repeatType },
        repeatDays: { L: repeatDays.map((day) => ({ S: day })) },
        active: { BOOL: input.active },
        completed: { BOOL: false },
        currentStreak: { N: "0" },
        bestStreak: { N: "0" },
        xpReward: { N: String(reward.xp) },
        coinReward: { N: String(reward.coins) },
        createdAt: { S: now },
        updatedAt: { S: now }
    };

    if (input.description != null) {
        item.description = { S: input.description };
    }
    if (startDate) item.startDate = { S: startDate };
    if (input.dueTime) item.dueTime = { S: input.dueTime };
    if (input.clientRequestId) item.createRequestHash = { S: requestHash };

    try {
        await client.send(new PutItemCommand({
            TableName: TABLE_NAME,
            Item: item,
            ConditionExpression: "attribute_not_exists(PK) AND attribute_not_exists(SK)"
        }));

        return response(201, {
            taskId,
            title: item.title.S,
            description: item.description?.S ?? null,
            taskSize: input.taskSize,
            repeatType,
            repeatDays,
            startDate,
            dueTime: input.dueTime ?? null,
            active: item.active.BOOL,
            completed: false,
            currentStreak: 0,
            bestStreak: 0,
            xpReward: reward.xp,
            coinReward: reward.coins,
            createdAt: now,
            updatedAt: now
        });
    } catch (error) {
        if (input.clientRequestId && error.name === "ConditionalCheckFailedException") {
            try {
                const existing = (await client.send(new GetItemCommand({ TableName: TABLE_NAME,
                    Key: { PK: item.PK, SK: item.SK }, ConsistentRead: true }))).Item;
                if (existing?.createRequestHash?.S !== requestHash) {
                    return conflict("TASK_REQUEST_CHANGED", "This retry key was already used for a different task.");
                }
                // A replay acknowledges the original creation without resetting edits/completions.
                return response(200, { taskId });
            } catch (failure) { return internalServerError("Read task retry failed", failure); }
        }
        return internalServerError("Create task failed", error);
    }
};
