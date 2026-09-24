import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import test from "node:test";

import { apiError } from "../src/api/errors.ts";
import { apiRoutes } from "../src/api/routes.ts";

const frontend = fileURLToPath(new URL("../", import.meta.url));
const repository = fileURLToPath(new URL("../../", import.meta.url));
const read = path => readFileSync(`${frontend}/${path}`, "utf8");
const template = readFileSync(`${repository}/backend/template.yaml`, "utf8");

function sourceFiles(directory) {
  return readdirSync(`${frontend}/${directory}`, { recursive: true, withFileTypes: true })
    .filter(entry => entry.isFile() && /\.(?:ts|tsx)$/.test(entry.name))
    .map(entry => readFileSync(`${entry.parentPath}/${entry.name}`, "utf8"))
    .join("\n");
}

function samHas(method, path) {
  const escaped = path.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`Path:\\s+${escaped}\\s+Method:\\s+${method}`, "m").test(template);
}

test("every active frontend network feature maps to an existing SAM route", () => {
  const routes = [
    ["GET", apiRoutes.me],
    ["PATCH", apiRoutes.me],
    ["DELETE", apiRoutes.me],
    ["GET", apiRoutes.entitlements],
    ["GET", apiRoutes.goals],
    ["GET", apiRoutes.achievements],
    ["GET", apiRoutes.tasks],
    ["POST", apiRoutes.tasks],
    ["DELETE", "/tasks/{taskId}"],
    ["POST", "/tasks/{taskId}/complete"],
    ["GET", apiRoutes.world],
    ["POST", "/world/buildings/{buildingId}/upgrade"],
    ["GET", apiRoutes.shop],
    ["POST", apiRoutes.shopPurchase],
    ["GET", apiRoutes.inventory],
    ["POST", apiRoutes.inventoryEquip],
    ["POST", apiRoutes.inventoryUnequip],
  ];
  for (const [method, path] of routes) {
    assert.equal(samHas(method, path), true, `${method} ${path} is missing from SAM`);
  }
});

test("frontend contains no legacy users, social, subscription-dev, weekly-quest, avatar, or base API paths", () => {
  const source = `${sourceFiles("app")}\n${sourceFiles("src")}`;
  assert.doesNotMatch(source, /["'`]\/users\//);
  assert.doesNotMatch(source, /["'`]\/social(?:\/|["'`?])/);
  assert.doesNotMatch(source, /["'`]\/subscription(?:\/|["'`?])/);
  assert.doesNotMatch(source, /["'`]\/weekly-quests(?:\/|["'`?])/);
  assert.doesNotMatch(source, /api\.(?:get|post|put|patch|delete)[^(]*\([^)]*["'`]\/avatar/);
  assert.doesNotMatch(source, /api\.(?:get|post|put|patch|delete)[^(]*\([^)]*["'`]\/base/);
});

test("task screen uses the SAM task methods and server-owned completion contract", () => {
  const tasks = read("app/(tabs)/tasks.tsx");
  assert.match(tasks, /api\.get<TasksResponse>\(apiRoutes\.tasks\)/);
  assert.match(tasks, /api\.post\(apiRoutes\.tasks,/);
  assert.match(tasks, /api\.post<CompletionResponse>\(apiRoutes\.completeTask\(task\.taskId\), \{\}\)/);
  assert.match(tasks, /api\.delete\(apiRoutes\.task\(task\.taskId\)\)/);
  assert.doesNotMatch(tasks, /dueDate|scheduledTime|repeatEndsAt|xpReward\s*:|coinReward\s*:/);
});

test("task creation renders every task size, defaults to NORMAL, and submits no custom rewards", () => {
  const tasks = read("app/(tabs)/tasks.tsx");
  for (const [value, label, xp] of [
    ["QUICK", "Quick", 10],
    ["SMALL", "Small", 20],
    ["NORMAL", "Normal", 35],
    ["CHALLENGING", "Challenging", 50],
    ["BIG", "Big", 75],
  ]) {
    assert.match(tasks, new RegExp(`value: "${value}", label: "${label}", xp: ${xp}`));
  }
  assert.match(tasks, /useState<TaskSize>\("NORMAL"\)/);
  assert.match(tasks, /description: description\.trim\(\) \|\| null,\s*taskSize,/);
  assert.doesNotMatch(tasks, /<LifeInput[^>]*placeholder=["'][^"']*(?:XP|coin)|xpReward\s*:|coinReward\s*:/i);
});

test("dashboard and profile XP bars use backend per-level progression", () => {
  const dashboard = read("app/(tabs)/dashboard.tsx");
  const profile = read("app/(tabs)/profile.tsx");

  assert.match(dashboard, /user\?\.xpIntoLevel/);
  assert.match(dashboard, /user\?\.xpForNextLevel/);
  assert.match(profile, /xpIntoLevel \/ xpForNextLevel/);
  assert.match(profile, /<XPBar progress=\{xpProgress\}/);
  assert.doesNotMatch(profile, /level \* 100|totalXp %/);
});

test("weekly progress uses GET goals and has no client claim mutation", () => {
  const dashboard = read("app/(tabs)/dashboard.tsx");
  assert.match(dashboard, /api\.get<GoalsResponse>\(apiRoutes\.goals\)/);
  assert.doesNotMatch(dashboard, /weekly-quests|claim|api\.post/);
});

test("shop uses read-only entitlements and the catalog-backed purchase route", () => {
  const shop = read("app/(tabs)/shop.tsx");
  assert.match(shop, /api\.get<EntitlementResponse>\(apiRoutes\.entitlements\)/);
  assert.match(shop, /api\.post\(apiRoutes\.shopPurchase, \{ itemId: item\.itemId \}\)/);
  assert.doesNotMatch(shop, /dev\/activate|price\s*:/);
});

test("shop explains achievement locks and exposes no purchase control while locked", () => {
  const shop = read("app/(tabs)/shop.tsx");
  const dashboard = read("app/(tabs)/dashboard.tsx");

  assert.match(shop, /item\.achievementRequirement/);
  assert.match(shop, /Complete &quot;\{requirement\.name\}&quot;/);
  assert.match(shop, /requirement\.currentValue\} \/ \{requirement\.requiredValue/);
  assert.match(shop, /locked \|\| item\.owned \? \(/);
  assert.match(shop, /item\.effectivePrice\} coins · \{item\.owned \? "Owned" : "Available"\}/);
  assert.match(dashboard, /Rewards: \{\(achievement\.rewards \?\? \[\]\)\.map/);
});

test("social and interior screens are inert and hidden from tab navigation", () => {
  assert.doesNotMatch(read("app/(tabs)/social.tsx"), /\bapi\./);
  assert.doesNotMatch(read("app/social-base.tsx"), /\bapi\./);
  assert.doesNotMatch(read("app/base-interior.tsx"), /\bapi\./);
  assert.match(read("app/(tabs)/_layout.tsx"), /name="social"[\s\S]*?href: null/);
});

test("body type stays in local appearance storage and PATCH me sends only supported fields", () => {
  const register = read("app/register.tsx");
  const profile = read("app/(tabs)/profile.tsx");
  const session = read("src/auth/session.ts");
  assert.match(register, /setLocalBodyType\(bodyType\)/);
  assert.match(profile, /api\.patch\(apiRoutes\.me, \{\s*displayName: displayName\.trim\(\),\s*timeZone: timeZone\.trim\(\),\s*\}\)/);
  assert.doesNotMatch(profile, /bodyType|xp\s*:|coins\s*:|worldPoints\s*:/);
  assert.doesNotMatch(session, /api\.patch|client\.patch/);
});

test("canonical backend error envelopes are surfaced and malformed errors use a safe fallback", () => {
  const details = [{ field: "timeZone", code: "INVALID" }];
  assert.deepEqual(apiError({ response: { data: { error: {
    code: "VALIDATION_ERROR", message: "Invalid time zone.", details,
  } } } }, "fallback"), {
    code: "VALIDATION_ERROR", message: "Invalid time zone.", details,
  });
  assert.deepEqual(apiError(new Error("network details"), "Please try again."), {
    code: "REQUEST_FAILED", message: "Please try again.",
  });
});
