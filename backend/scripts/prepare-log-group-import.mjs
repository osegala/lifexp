#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const STACK_NAME = "evrenthia-dev";
const REGION = "us-east-2";
const PROFILE = "evrenthia-admin";
const PREFIX = "/aws/lambda/Evrenthia-Dev-";
const backend = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const outputDirectory = resolve(backend, "cloudformation");

const logGroups = [
    ["CreateProfileLogGroup", "CreateProfile"],
    ["GetMeLogGroup", "GetMe"],
    ["GetEntitlementsLogGroup", "GetEntitlements"],
    ["GetPreferencesLogGroup", "GetPreferences"],
    ["UpdatePreferencesLogGroup", "UpdatePreferences"],
    ["GetDevicesLogGroup", "GetDevices"],
    ["RegisterDeviceLogGroup", "RegisterDevice"],
    ["DisableDeviceLogGroup", "DisableDevice"],
    ["GetRemindersLogGroup", "GetReminders"],
    ["CreateReminderLogGroup", "CreateReminder"],
    ["UpdateReminderLogGroup", "UpdateReminder"],
    ["DeleteReminderLogGroup", "DeleteReminder"],
    ["NotificationWorkerLogGroup", "NotificationWorker"],
    ["GetTasksLogGroup", "GetTasks"],
    ["CreateTaskLogGroup", "CreateTask"],
    ["UpdateTaskLogGroup", "UpdateTask"],
    ["DeleteTaskLogGroup", "DeleteTask"],
    ["CompleteTaskLogGroup", "CompleteTask"],
    ["GetGoalsLogGroup", "GetGoals"],
    ["GetHistoryLogGroup", "GetHistory"],
    ["GetCompletionHistoryLogGroup", "GetCompletionHistory"],
    ["GetAchievementsLogGroup", "GetAchievements"],
    ["GetWorldLogGroup", "GetWorld"],
    ["UpgradeBuildingLogGroup", "UpgradeBuilding"],
    ["GetShopLogGroup", "GetShop"],
    ["PurchaseItemLogGroup", "PurchaseItem"],
    ["GetInventoryLogGroup", "GetInventory"],
    ["EquipItemLogGroup", "EquipItem"],
    ["UnequipItemLogGroup", "UnequipItem"],
    ["UpdateMeLogGroup", "UpdateMe"]
].map(([logicalId, suffix]) => ({ logicalId, name: `${PREFIX}${suffix}` }));

function aws(...args) {
    return execFileSync("aws", [...args, "--region", REGION, "--profile", PROFILE], {
        encoding: "utf8",
        env: { ...process.env, AWS_PAGER: "" }
    });
}

const deployedTemplate = aws(
    "cloudformation", "get-template",
    "--stack-name", STACK_NAME,
    "--template-stage", "Original",
    "--query", "TemplateBody",
    "--output", "text"
);
const inventory = JSON.parse(aws(
    "logs", "describe-log-groups",
    "--log-group-name-prefix", PREFIX,
    "--output", "json"
));
const actualNames = new Set(inventory.logGroups.map(({ logGroupName }) => logGroupName));
const expectedNames = new Set(logGroups.map(({ name }) => name));
const existing = logGroups.filter(({ name }) => actualNames.has(name));
const missing = logGroups.filter(({ name }) => !actualNames.has(name)).map(({ name }) => name);
const unexpected = [...actualNames].filter((name) => !expectedNames.has(name)).sort();

for (const forbidden of [
    "AWS::Logs::LogGroup",
    "AWS::CloudWatch::Alarm",
    "AWS::CloudWatch::Dashboard",
    "AWS::Budgets::Budget",
    "LoggingConfig:"
]) {
    if (deployedTemplate.includes(forbidden)) {
        throw new Error(`Deployed template already contains ${forbidden}; refresh the import strategy before continuing.`);
    }
}

const marker = "\nOutputs:\n";
if (!deployedTemplate.includes(marker)) throw new Error("Could not locate Outputs in the deployed template.");

const resources = existing.map(({ logicalId, name }) => `  ${logicalId}:
    Type: AWS::Logs::LogGroup
    DeletionPolicy: Retain
    UpdateReplacePolicy: Retain
    Properties:
      LogGroupName: ${name}
      RetentionInDays: 14
`).join("\n");
const importTemplate = deployedTemplate.replace(marker, `\n${resources}\nOutputs:\n`);
const imports = existing.map(({ logicalId, name }) => ({
    ResourceType: "AWS::Logs::LogGroup",
    LogicalResourceId: logicalId,
    ResourceIdentifier: { LogGroupName: name }
}));

mkdirSync(outputDirectory, { recursive: true });
writeFileSync(resolve(outputDirectory, "log-group-import-template.yaml"), importTemplate);
writeFileSync(resolve(outputDirectory, "log-group-imports.json"), `${JSON.stringify(imports, null, 2)}\n`);

process.stdout.write(`${JSON.stringify({
    expected: logGroups.length,
    existing: existing.length,
    missing,
    unexpected,
    template: "cloudformation/log-group-import-template.yaml",
    mappings: "cloudformation/log-group-imports.json"
}, null, 2)}\n`);
