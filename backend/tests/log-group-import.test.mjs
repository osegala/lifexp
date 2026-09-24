import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";

const backend = fileURLToPath(new URL("../", import.meta.url));
const template = readFileSync(`${backend}/cloudformation/log-group-import-template.yaml`, "utf8");
const imports = JSON.parse(readFileSync(`${backend}/cloudformation/log-group-imports.json`, "utf8"));

function resourceBlock(name) {
    const marker = `  ${name}:\n`;
    const start = template.indexOf(marker);
    assert.notEqual(start, -1, name);
    const remainder = template.slice(start + marker.length);
    const next = remainder.search(/\n  [A-Z][A-Za-z0-9]+:\n/);
    return marker + (next < 0 ? remainder : remainder.slice(0, next));
}

test("import snapshot contains the deployed stack plus only existing log groups", () => {
    assert.match(template, /Transform: AWS::Serverless-2016-10-31/);
    assert.equal((template.match(/Type: AWS::Serverless::Function/g) ?? []).length, 30);
    assert.equal((template.match(/Type: AWS::Logs::LogGroup/g) ?? []).length, 25);
    assert.doesNotMatch(template, /AWS::CloudWatch::Alarm|AWS::CloudWatch::Dashboard|AWS::Budgets::Budget/);
    assert.doesNotMatch(template, /LoggingConfig:/);
    assert.ok(statSync(`${backend}/cloudformation/log-group-import-template.yaml`).size < 51_200);
});

test("every resource mapping has a matching retained 14-day static log group", () => {
    assert.equal(imports.length, 25);
    assert.equal(new Set(imports.map(({ LogicalResourceId }) => LogicalResourceId)).size, imports.length);
    assert.equal(new Set(imports.map(({ ResourceIdentifier }) => ResourceIdentifier.LogGroupName)).size, imports.length);

    for (const entry of imports) {
        assert.equal(entry.ResourceType, "AWS::Logs::LogGroup");
        assert.match(entry.ResourceIdentifier.LogGroupName, /^\/aws\/lambda\/Evrenthia-Dev-/);
        const block = resourceBlock(entry.LogicalResourceId);
        assert.match(block, /DeletionPolicy: Retain/);
        assert.match(block, /UpdateReplacePolicy: Retain/);
        assert.match(block, /RetentionInDays: 14/);
        assert.ok(block.includes(`LogGroupName: ${entry.ResourceIdentifier.LogGroupName}`));
        assert.doesNotMatch(block, /Fn::Sub|Ref:/);
    }
});

test("nonexistent development log groups are deferred to the later normal update", () => {
    for (const logicalId of [
        "DisableDeviceLogGroup",
        "UpdateReminderLogGroup",
        "DeleteReminderLogGroup",
        "EquipItemLogGroup",
        "UnequipItemLogGroup"
    ]) {
        assert.equal(imports.some((entry) => entry.LogicalResourceId === logicalId), false, logicalId);
        assert.doesNotMatch(template, new RegExp(`^  ${logicalId}:`, "m"), logicalId);
    }
});
