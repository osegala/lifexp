import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import * as profileLogic from "../functions/update-me/logic.mjs";
import * as http from "../layers/api-shared/nodejs/http.mjs";
import * as appearance from "../layers/api-shared/nodejs/appearance.mjs";
import { notificationWakeups } from "../layers/api-shared/nodejs/notification-wakeup.mjs";
import { nextDueAt } from "../layers/notification-shared/nodejs/scheduling.mjs";

const regions = [
    ["EST", "America/New_York", 14, 13], ["CST", "America/Chicago", 15, 14],
    ["MST", "America/Denver", 16, 15], ["PST", "America/Los_Angeles", 17, 16]
];
test("profile API persists regional IANA zones for legacy clients and rejects offsets/unknown abbreviations", () => {
    for (const [legacy, zone] of regions) {
        assert.deepEqual(profileLogic.validateProfilePatch({ timeZone: legacy }), { timeZone: zone });
        assert.equal(profileLogic.isValidTimeZone(zone), true);
    }
    assert.deepEqual(profileLogic.validateProfilePatch({ timeZone: "Asia/Kolkata" }), { timeZone: "Asia/Kolkata" });
    for (const timeZone of ["BAD", "Moon/Tranquility", "+05:00", "GMT-0500", "__proto__", null]) {
        assert.throws(() => profileLogic.validateProfilePatch({ timeZone }), { code: "INVALID_TIME_ZONE" });
    }
});

test("migrated regions keep 9am notifications at the local clock across daylight saving", () => {
    for (const [legacy, , winter, summer] of regions) {
        const { timeZone } = profileLogic.validateProfilePatch({ timeZone: legacy });
        assert.equal(nextDueAt({ timeZone, localTime: "09:00" }, new Date("2026-01-15T00:00Z")), `2026-01-15T${winter}:00:00.000Z`);
        assert.equal(nextDueAt({ timeZone, localTime: "09:00" }, new Date("2026-07-15T00:00Z")), `2026-07-15T${summer}:00:00.000Z`);
    }
});

test("actual timezone PATCH atomically saves IANA and wakes task and daily notification configurations", async () => {
    const S = value => ({ S: value });
    const profile = { PK: S("USER#test"), SK: S("PROFILE"), timeZone: S("EST"), displayName: S("Hero") };
    const preferences = { PK: profile.PK, SK: S("PREFERENCES"), updatedAt: S("2026-01-01T00:00:00Z"), GSI1PK: S("NOTIFICATION_DUE") };
    const reminder = { PK: profile.PK, SK: S("REMINDER#read"), enabled: { BOOL: true }, updatedAt: preferences.updatedAt };
    const transactions = [];
    const sdk = Object.fromEntries(["GetItemCommand", "UpdateItemCommand", "QueryCommand", "TransactWriteItemsCommand"].map(name =>
        [name, class { constructor(input) { this.input = input; this.name = name; } }]));
    sdk.DynamoDBClient = class {
        async send({ name, input }) {
            if (name === "GetItemCommand") return { Item: structuredClone(input.Key.SK.S === "PROFILE" ? profile : preferences) };
            if (name === "QueryCommand") return { Items: [reminder] };
            assert.equal(name, "TransactWriteItemsCommand");
            transactions.push(input.TransactItems);
            profile.timeZone = input.TransactItems[0].Update.ExpressionAttributeValues[":timeZone"];
            return {};
        }
    };
    const imports = { "@aws-sdk/client-dynamodb": sdk, "/opt/nodejs/notification-wakeup.mjs": { notificationWakeups },
        "./logic.mjs": profileLogic, "/opt/nodejs/appearance.mjs": appearance, "/opt/nodejs/http.mjs": http };
    const source = readFileSync(new URL("../functions/update-me/index.mjs", import.meta.url), "utf8")
        .replace(/import\s*\{([^}]+)\}\s*from\s*"([^"]+)";/g, (_, members, path) => `const {${members.replace(/\bas\b/g, ":")}} = imports[${JSON.stringify(path)}];`)
        .replace("export const handler", "const handler");
    const handler = new Function("imports", "process", `${source}; return handler;`)(imports, { env: { TABLE_NAME: "local" } });
    for (const zone of ["EST", "America/Los_Angeles"]) {
        const result = await handler({ requestContext: { authorizer: { jwt: { claims: { sub: "test" } } } }, body: JSON.stringify({ timeZone: zone }) });
        assert.equal(result.statusCode, 200);
        assert.equal(JSON.parse(result.body).timeZone, zone === "EST" ? "America/New_York" : zone);
        const writes = transactions.at(-1);
        assert.deepEqual(writes.map(entry => entry.Update.Key.SK.S), ["PROFILE", "REMINDER#read", "PREFERENCES"]);
        assert.ok(writes.every(entry => entry.Update), "no duplicate reminder/occurrence records");
        assert.match(writes[1].Update.ConditionExpression, /#updated = :updated/);
        assert.match(writes[2].Update.ConditionExpression, /#updated = :updated/);
        assert.match(writes[1].Update.ExpressionAttributeValues[":sort"].S, /#REMINDER#read$/);
        assert.match(writes[2].Update.ExpressionAttributeValues[":sort"].S, /#PREFERENCES$/);
    }
});
