import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import test from "node:test";

import { authSubject } from "../layers/api-shared/nodejs/http.mjs";
import {
    MAX_BATCH_SIZE,
    MAX_UNPROCESSED_RETRIES,
    cognitoUsername,
    deleteBatches,
    deleteUserPartition,
    executeAccountDeletion,
    userPartitionQuery
} from "../functions/delete-account/logic.mjs";

const backend = fileURLToPath(new URL("../", import.meta.url));
const template = readFileSync(`${backend}/template.yaml`, "utf8");
const handler = readFileSync(`${backend}/functions/delete-account/index.mjs`, "utf8");

function resourceBlock(name) {
    const marker = `  ${name}:\n`;
    const start = template.indexOf(marker);
    assert.notEqual(start, -1, name);
    const remainder = template.slice(start + marker.length);
    const next = remainder.search(/\n  [A-Z][A-Za-z0-9]+:\n/);
    return marker + (next < 0 ? remainder : remainder.slice(0, next));
}

const key = (pk, sk) => ({ PK: { S: pk }, SK: { S: sk } });

test("account identity comes only from authenticated JWT claims", () => {
    const event = {
        body: JSON.stringify({ sub: "victim", userId: "victim", username: "victim" }),
        queryStringParameters: { sub: "victim" },
        requestContext: { authorizer: { jwt: { claims: {
            sub: "signed-in-sub",
            "cognito:username": "signed-in-username"
        } } } }
    };
    const subject = authSubject(event);
    assert.equal(subject, "signed-in-sub");
    assert.equal(cognitoUsername(event, subject), "signed-in-username");
    assert.equal(cognitoUsername({ body: event.body }, subject), subject);
});

test("user deletion queries one exact user partition without scanning", () => {
    const request = userPartitionQuery("Evrenthia-Dev", "USER#signed-in-sub", key("USER#signed-in-sub", "TASK#25"));
    assert.equal(request.KeyConditionExpression, "#pk = :pk");
    assert.deepEqual(request.ExpressionAttributeValues, { ":pk": { S: "USER#signed-in-sub" } });
    assert.deepEqual(request.ExclusiveStartKey, key("USER#signed-in-sub", "TASK#25"));
    assert.equal(request.ConsistentRead, true);
    assert.doesNotMatch(JSON.stringify(request), /Scan/);
    assert.throws(
        () => deleteBatches("Evrenthia-Dev", "USER#signed-in-sub", [key("CATALOG#COSMETICS", "ITEM#starter_tunic")]),
        /unexpected key/
    );
});

test("all paginated user records are deleted in batches of at most 25 while catalogs remain", async () => {
    const userPk = "USER#signed-in-sub";
    const userRecords = Array.from({ length: 58 }, (_, index) => key(userPk, `RECORD#${index}`));
    const catalogs = [
        key("CATALOG#COSMETICS", "ITEM#starter_tunic"),
        key("CATALOG#ACHIEVEMENTS", "ACHIEVEMENT#FIRST_TASK"),
        key("CATALOG#BUILDINGS", "BUILDING#home_base")
    ];
    const table = [...userRecords, ...catalogs];
    const queries = [];
    const batches = [];
    const deleted = new Set();

    const deletedCount = await deleteUserPartition({
        tableName: "Evrenthia-Dev",
        userId: "signed-in-sub",
        queryPage: async (request) => {
            queries.push(request);
            const start = request.ExclusiveStartKey ? 30 : 0;
            const records = table.filter((item) => item.PK.S === request.ExpressionAttributeValues[":pk"].S);
            return {
                Items: records.slice(start, start + 30),
                LastEvaluatedKey: start === 0 ? records[29] : undefined
            };
        },
        writeBatch: async (request) => {
            const writes = request.RequestItems["Evrenthia-Dev"];
            batches.push(writes);
            for (const write of writes) {
                const deleting = write.DeleteRequest.Key;
                deleted.add(`${deleting.PK.S}|${deleting.SK.S}`);
            }
            return {};
        },
        sleep: async () => {}
    });

    assert.equal(deletedCount, 58);
    assert.equal(queries.length, 2);
    assert.deepEqual(batches.map((batch) => batch.length), [MAX_BATCH_SIZE, 5, MAX_BATCH_SIZE, 3]);
    assert.ok(batches.flat().every((write) => write.DeleteRequest.Key.PK.S === userPk));
    assert.ok(userRecords.every((item) => deleted.has(`${item.PK.S}|${item.SK.S}`)));
    assert.ok(catalogs.every((item) => !deleted.has(`${item.PK.S}|${item.SK.S}`)));
});

test("unprocessed batch items are retried with bounded backoff", async () => {
    const writes = [];
    const waits = [];
    let attempt = 0;
    const items = [key("USER#user-1", "PROFILE"), key("USER#user-1", "TASK#1")];

    assert.equal(await deleteUserPartition({
        tableName: "table",
        userId: "user-1",
        queryPage: async () => ({ Items: items }),
        writeBatch: async (request) => {
            writes.push(request.RequestItems.table);
            attempt++;
            return attempt === 1 ? { UnprocessedItems: { table: [request.RequestItems.table[1]] } } : {};
        },
        sleep: async (milliseconds) => { waits.push(milliseconds); }
    }), 2);
    assert.deepEqual(writes.map((batch) => batch.length), [2, 1]);
    assert.deepEqual(waits, [25]);
});

test("unprocessed batch retries stop at the configured bound", async () => {
    let attempts = 0;
    const item = key("USER#user-1", "PROFILE");
    await assert.rejects(deleteUserPartition({
        tableName: "table",
        userId: "user-1",
        queryPage: async () => ({ Items: [item] }),
        writeBatch: async (request) => {
            attempts++;
            return { UnprocessedItems: request.RequestItems };
        },
        sleep: async () => {}
    }), /retries exhausted/);
    assert.equal(attempts, MAX_UNPROCESSED_RETRIES + 1);
});

test("Cognito deletion occurs only after application data succeeds", async () => {
    const calls = [];
    await executeAccountDeletion({
        deleteApplicationData: async () => { calls.push("data"); },
        deleteCognitoIdentity: async () => { calls.push("cognito"); }
    });
    assert.deepEqual(calls, ["data", "cognito"]);

    await assert.rejects(executeAccountDeletion({
        deleteApplicationData: async () => { throw new Error("DynamoDB failed"); },
        deleteCognitoIdentity: async () => { calls.push("should-not-run"); }
    }));
    assert.doesNotMatch(calls.join(","), /should-not-run/);
});

test("DELETE me infrastructure is authorized and least privilege", () => {
    const block = resourceBlock("DeleteAccountFunction");
    assert.match(block, /CodeUri: functions\/delete-account\//);
    assert.match(block, /Path: \/me\n\s+Method: DELETE/);
    assert.match(block, /Authorizer: EvrenthiaCognito/);
    assert.deepEqual(
        [...block.matchAll(/- dynamodb:([A-Za-z]+)/g)].map((match) => match[1]).sort(),
        ["BatchWriteItem", "Query"]
    );
    assert.match(block, /- cognito-idp:AdminDeleteUser/);
    assert.match(block, /- EvrenthiaDevUserPool\n\s+- Arn/);
    assert.doesNotMatch(block, /cognito-idp:\*|dynamodb:(?:Scan|DeleteItem)|Resource: ["']?\*/);
});

test("handler returns canonical outcomes and logs deletion stages without request data", () => {
    assert.match(handler, /if \(!userId\) return unauthorized\(\)/);
    assert.match(handler, /return noContent\(\)/);
    assert.match(handler, /return internalServerError\("Account deletion failed", error\)/);
    assert.match(handler, /ACCOUNT_DELETION_STARTED/);
    assert.match(handler, /ACCOUNT_APPLICATION_DATA_DELETED/);
    assert.match(handler, /ACCOUNT_COGNITO_IDENTITY_DELETED/);
    assert.match(handler, /ACCOUNT_DELETION_FAILED/);
    assert.doesNotMatch(handler, /event\.body|queryStringParameters|accessToken|idToken|refreshToken|password/);
});
