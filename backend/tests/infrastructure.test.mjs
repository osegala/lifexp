import test from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { loadSeedItems } from "../seeds/seed-catalogs.mjs";

const repository = fileURLToPath(new URL("../../", import.meta.url));
const backend = fileURLToPath(new URL("../", import.meta.url));
const template = readFileSync(`${backend}/template.yaml`, "utf8");
const samconfig = readFileSync(`${backend}/samconfig.toml`, "utf8");
const workflows = readdirSync(`${repository}/.github/workflows`)
    .filter((name) => /\.ya?ml$/.test(name))
    .map((name) => readFileSync(`${repository}/.github/workflows/${name}`, "utf8"))
    .join("\n");

function configSection(name) {
    const marker = `[${name}]`;
    const start = samconfig.indexOf(marker);
    assert.notEqual(start, -1, name);
    const remainder = samconfig.slice(start + marker.length);
    const next = remainder.search(/\n\[[^\]]+\]/);
    return next < 0 ? remainder : remainder.slice(0, next);
}

test("template creates and references the isolated development table", () => {
    assert.match(template, /EvrenthiaDevTable:\n    Type: AWS::DynamoDB::Table/);
    assert.match(template, /TableName:\n        Ref: FunctionNamePrefix/);
    assert.match(template, /BillingMode: PAY_PER_REQUEST/);
    assert.match(template, /TABLE_NAME:\n          Ref: EvrenthiaDevTable/);
    assert.doesNotMatch(template, /\$\{TableName\}|\n  TableName:\n    Type: String|TableName: Evrenthia(?:\s|$)/);

    const dynamoPolicyResources = template.match(/Fn::GetAtt:\n\s+- EvrenthiaDevTable\n\s+- Arn/g) ?? [];
    assert.equal(dynamoPolicyResources.length, 33);
});

test("development table has one sparse due-notification index", () => {
    assert.match(template, /- AttributeName: GSI1PK\n\s+AttributeType: S/);
    assert.match(template, /- AttributeName: GSI1SK\n\s+AttributeType: S/);
    assert.equal((template.match(/IndexName: NotificationDueIndex/g) ?? []).length, 1);
    assert.match(template, /IndexName: NotificationDueIndex[\s\S]*?ProjectionType: KEYS_ONLY/);
});

function resourceBlock(name) {
    const marker = `  ${name}:\n`;
    const start = template.indexOf(marker);
    assert.notEqual(start, -1, name);
    const remainder = template.slice(start + marker.length);
    const next = remainder.search(/\n  [A-Z][A-Za-z0-9]+:\n/);
    return marker + (next < 0 ? remainder : remainder.slice(0, next));
}

test("all Lambda log groups use environment-scoped names and retention", () => {
    assert.match(template, /LoggingConfig:\n\s+LogFormat: JSON\n\s+ApplicationLogLevel: INFO\n\s+SystemLogLevel: WARN/);
    assert.match(template, /LogRetentionDays:[\s\S]*?Default: 14[\s\S]*?Description: CloudWatch Logs retention period/);
    const functions = [
        "CreateProfile", "GetMe", "GetEntitlements", "GetPreferences", "UpdatePreferences",
        "GetDevices", "RegisterDevice", "DisableDevice", "GetReminders", "CreateReminder",
        "UpdateReminder", "DeleteReminder", "NotificationWorker", "GetTasks", "CreateTask",
        "UpdateTask", "DeleteTask", "CompleteTask", "GetGoals", "GetHistory",
        "GetCompletionHistory", "GetAchievements", "GetWorld", "UpgradeBuilding", "GetShop",
        "PurchaseItem", "GetInventory", "EquipItem", "UnequipItem", "UpdateMe",
        "DeleteAccount"
    ];
    assert.equal((template.match(/Type: AWS::Logs::LogGroup/g) ?? []).length, functions.length);
    for (const name of functions) {
        const block = resourceBlock(`${name}LogGroup`);
        assert.match(block, new RegExp(`Fn::Sub: "/aws/lambda/\\$\\{FunctionNamePrefix\\}-${name}"`), name);
        assert.match(block, /RetentionInDays:\n\s+Ref: LogRetentionDays/, name);
        assert.match(block, /DeletionPolicy: Retain/, name);
    }
});

test("environment-scoped alarms cover API, critical Lambdas, and DynamoDB throttling", () => {
    const lambdaAlarms = [
        ["CompleteTaskErrorsAlarm", "CompleteTaskFunction"],
        ["PurchaseItemErrorsAlarm", "PurchaseItemFunction"],
        ["UpgradeBuildingErrorsAlarm", "UpgradeBuildingFunction"],
        ["NotificationWorkerErrorsAlarm", "NotificationWorkerFunction"],
        ["CreateProfileErrorsAlarm", "CreateProfileFunction"]
    ];
    const api = resourceBlock("Api5xxAlarm");
    assert.match(api, /AlarmName:\n\s+Fn::Sub: "\$\{FunctionNamePrefix\}-Api-5XX"/);
    assert.match(api, /Namespace: AWS\/ApiGateway/);
    assert.match(api, /MetricName: 5xx/);
    assert.match(api, /Name: ApiId[\s\S]*?Ref: EvrenthiaDevApi/);
    assert.match(api, /Name: Stage\n\s+Value: "\$default"/);
    assert.match(api, /Period: 300[\s\S]*?Threshold: 5/);

    for (const [alarm, fn] of lambdaAlarms) {
        const block = resourceBlock(alarm);
        assert.match(block, /AlarmName:\n\s+Fn::Sub: "\$\{FunctionNamePrefix\}-/);
        assert.match(block, /Namespace: AWS\/Lambda/);
        assert.match(block, /MetricName: Errors/);
        assert.match(block, new RegExp(`Ref: ${fn}`));
        assert.match(block, /Period: 300[\s\S]*?Threshold: 3/);
    }

    const dynamo = resourceBlock("DynamoDbThrottleAlarm");
    assert.match(dynamo, /AlarmName:\n\s+Fn::Sub: "\$\{FunctionNamePrefix\}-DynamoDB-ThrottledRequests"/);
    assert.match(dynamo, /Namespace: AWS\/DynamoDB/);
    assert.match(dynamo, /MetricName: ThrottledRequests/);
    assert.match(dynamo, /Ref: EvrenthiaDevTable/);
    assert.match(dynamo, /Threshold: 1/);
    assert.equal((template.match(/TreatMissingData: notBreaching/g) ?? []).length, 7);
    assert.doesNotMatch(template, /TreatMissingData: breaching/i);
});

test("one environment-scoped dashboard contains the requested health signals", () => {
    assert.equal((template.match(/Type: AWS::CloudWatch::Dashboard/g) ?? []).length, 1);
    const dashboard = resourceBlock("EvrenthiaDevDashboard");
    assert.match(dashboard, /DashboardName:\n\s+Ref: FunctionNamePrefix/);
    for (const signal of [
        "Count", "4xx", "5xx", "CompleteTaskFunction", "PurchaseItemFunction",
        "UpgradeBuildingFunction", "NotificationWorkerFunction", "Duration", "ThrottledRequests"
    ]) assert.match(dashboard, new RegExp(signal), signal);
});

test("environment-scoped budget is account-wide and conditionally sends 50/80/100 percent alerts", () => {
    assert.match(template, /BudgetNotificationEmail:[\s\S]*?Default: ""/);
    const budget = resourceBlock("EvrenthiaDevBudget");
    assert.match(budget, /Type: AWS::Budgets::Budget/);
    assert.match(budget, /BudgetName:\n\s+Fn::Sub: "\$\{FunctionNamePrefix\}-Monthly-10-USD"/);
    assert.match(budget, /Amount: 10\n\s+Unit: USD/);
    assert.match(budget, /BudgetType: COST/);
    assert.deepEqual([...budget.matchAll(/Threshold: (\d+)/g)].map((match) => Number(match[1])), [50, 80, 100]);
    assert.match(budget, /NotificationsWithSubscribers:\n\s+Fn::If:\n\s+- HasBudgetNotificationEmail[\s\S]*?- Ref: AWS::NoValue/);
    assert.doesNotMatch(budget, /CostFilters:/);
});

test("observability adds no broad application permissions or production services", () => {
    assert.doesNotMatch(template, /(?:cloudwatch|logs|budgets):\*/i);
    assert.doesNotMatch(template, /AWS::(?:XRay|OpenSearchService|Kinesis|SNS)::/);
    assert.doesNotMatch(template, /Evrenthia-Prod/);
    assert.doesNotMatch(template, /ProvisionedThroughput|ReadCapacityUnits|WriteCapacityUnits/);
});

test("preference, device, and reminder routes use JWT auth and least-privilege actions", () => {
    const resources = [
        ["GetPreferencesFunction", "/preferences", "GET", ["GetItem"]],
        ["UpdatePreferencesFunction", "/preferences", "PATCH", ["GetItem", "UpdateItem"]],
        ["GetDevicesFunction", "/devices", "GET", ["GetItem", "Query"]],
        ["RegisterDeviceFunction", "/devices", "POST", ["GetItem", "UpdateItem"]],
        ["DisableDeviceFunction", "/devices/{deviceId}", "DELETE", ["GetItem", "UpdateItem"]],
        ["GetRemindersFunction", "/reminders", "GET", ["GetItem", "Query"]],
        ["CreateReminderFunction", "/reminders", "POST", ["GetItem", "PutItem"]],
        ["UpdateReminderFunction", "/reminders/{reminderId}", "PATCH", ["GetItem", "UpdateItem"]],
        ["DeleteReminderFunction", "/reminders/{reminderId}", "DELETE", ["GetItem", "UpdateItem"]]
    ];

    for (const [name, path, method, actions] of resources) {
        const block = resourceBlock(name);
        assert.ok(block.includes(`Path: ${path}`), name);
        assert.ok(block.includes(`Method: ${method}`), name);
        assert.ok(block.includes("Authorizer: EvrenthiaCognito"), name);
        assert.deepEqual(
            [...block.matchAll(/- dynamodb:([A-Za-z]+)/g)].map((match) => match[1]).sort(),
            [...actions].sort(),
            name
        );
    }
});

test("one environment-scoped schedule invokes the notification worker with safe delivery defaults", () => {
    const block = resourceBlock("NotificationWorkerFunction");
    assert.equal((template.match(/\n\s+Type: Schedule\n/g) ?? []).length, 1);
    assert.match(block, /CodeUri: functions\/notification-worker\//);
    assert.match(template, /PushDeliveryMode:[\s\S]*?Default: DRY_RUN[\s\S]*?AllowedValues:\n\s+- DRY_RUN\n\s+- LIVE/);
    assert.match(block, /PUSH_DELIVERY_MODE:\n\s+Ref: PushDeliveryMode/);
    assert.match(block, /Type: Schedule/);
    assert.match(block, /Name:\n\s+Fn::Sub: "\$\{FunctionNamePrefix\}-NotificationWorker-EveryMinute"/);
    assert.match(block, /Schedule: rate\(1 minute\)/);
    assert.match(block, /NotificationDueIndex/);
    assert.doesNotMatch(block, /dynamodb:(?:Scan|DeleteItem)/);
    assert.deepEqual(
        [...block.matchAll(/- dynamodb:([A-Za-z]+)/g)].map((match) => match[1]).sort(),
        ["GetItem", "PutItem", "Query", "UpdateItem"]
    );
});

test("GET /entitlements uses JWT authorization and GetItem-only DynamoDB access", () => {
    const resource = resourceBlock("GetEntitlementsFunction");
    assert.match(resource, /CodeUri: functions\/get-entitlements\//);
    assert.match(resource, /Action:\n\s+- dynamodb:GetItem/);
    assert.doesNotMatch(resource, /dynamodb:(?:PutItem|UpdateItem|DeleteItem|Query)/);
    assert.match(resource, /Path: \/entitlements/);
    assert.match(resource, /Method: GET/);
    assert.match(resource, /Authorizer: EvrenthiaCognito/);
});

test("progression handlers share one SAM layer and retain scoped DynamoDB actions", () => {
    assert.match(template, /ProgressionSharedLayer:[\s\S]*?ContentUri: layers\/progression-shared\//);
    for (const name of [
        "CompleteTaskFunction",
        "GetAchievementsFunction",
        "GetWorldFunction",
        "UpgradeBuildingFunction",
        "GetShopFunction",
        "PurchaseItemFunction"
    ]) {
        assert.match(resourceBlock(name), /- Ref: ProgressionSharedLayer/, name);
    }
    assert.deepEqual(
        [...resourceBlock("UpgradeBuildingFunction").matchAll(/- dynamodb:([A-Za-z]+)/g)]
            .map((match) => match[1]).sort(),
        ["GetItem", "PutItem", "Query", "UpdateItem"]
    );
    assert.deepEqual(
        [...resourceBlock("PurchaseItemFunction").matchAll(/- dynamodb:([A-Za-z]+)/g)]
            .map((match) => match[1]).sort(),
        ["GetItem", "PutItem", "Query", "UpdateItem"]
    );
    assert.doesNotMatch(template, /dynamodb:TransactWriteItems/);
});

test("every public API handler receives and imports the canonical API helper layer", () => {
    assert.doesNotMatch(template.slice(template.indexOf("Globals:"), template.indexOf("Resources:")), /ApiSharedLayer/);
    assert.match(template, /ApiSharedLayer:[\s\S]*?ContentUri: layers\/api-shared\//);
    const handlers = [
        ["GetMeFunction", "get-me/index.mjs"], ["UpdateMeFunction", "update-me/index.mjs"],
        ["DeleteAccountFunction", "delete-account/index.mjs"],
        ["CreateTaskFunction", "create-task/index.mjs"], ["GetTasksFunction", "get-tasks/index.mjs"],
        ["UpdateTaskFunction", "update-task/index.mjs"], ["DeleteTaskFunction", "delete-task/index.mjs"],
        ["CompleteTaskFunction", "complete-task/index.mjs"], ["GetGoalsFunction", "get-goals/index.mjs"],
        ["GetHistoryFunction", "get-history/index.mjs"], ["GetCompletionHistoryFunction", "get-completion-history/index.mjs"],
        ["GetAchievementsFunction", "get-achievements/index.mjs"], ["GetShopFunction", "get-shop/index.mjs"],
        ["PurchaseItemFunction", "purchase-item/index.mjs"], ["GetInventoryFunction", "get-inventory/index.mjs"],
        ["EquipItemFunction", "equip-item/index.mjs"], ["UnequipItemFunction", "unequip-item/index.mjs"],
        ["GetWorldFunction", "get-world/index.mjs"], ["UpgradeBuildingFunction", "upgrade-building/index.mjs"],
        ["GetEntitlementsFunction", "get-entitlements/index.mjs"], ["GetPreferencesFunction", "preferences/get.mjs"],
        ["UpdatePreferencesFunction", "preferences/update.mjs"], ["GetDevicesFunction", "devices/get.mjs"],
        ["RegisterDeviceFunction", "devices/register.mjs"], ["DisableDeviceFunction", "devices/disable.mjs"],
        ["GetRemindersFunction", "reminders/get.mjs"], ["CreateReminderFunction", "reminders/create.mjs"],
        ["UpdateReminderFunction", "reminders/update.mjs"], ["DeleteReminderFunction", "reminders/disable.mjs"]
    ];
    const authenticatedFunctions = [...template.matchAll(/^  ([A-Za-z0-9]+Function):$/gm)]
        .map((match) => match[1])
        .filter((resource) => /Authorizer: EvrenthiaCognito/.test(resourceBlock(resource)))
        .sort();
    assert.equal(handlers.length, 29);
    assert.deepEqual(authenticatedFunctions, handlers.map(([resource]) => resource).sort());

    for (const [resource, path] of handlers) {
        const block = resourceBlock(resource);
        const source = readFileSync(`${backend}/functions/${path}`, "utf8");
        assert.match(block, /- Ref: ApiSharedLayer/, resource);
        assert.match(block, /- dynamodb:GetItem/, `${resource} active-profile read permission`);
        assert.doesNotMatch(block, /dynamodb:\*|Resource:\s*["']?\*/, `${resource} least privilege`);
        assert.match(source, /\/opt\/nodejs\/http\.mjs/, path);
        assert.match(source, /await requireActivePlayer\(event,/, `${path} active-profile guard`);
        assert.doesNotMatch(
            source,
            /new PutItemCommand\(\{[\s\S]{0,800}?SK:\s*\{\s*S:\s*["']PROFILE["']/,
            `${path} must not auto-create PROFILE`
        );
    }
    const createTaskSource = readFileSync(`${backend}/functions/create-task/index.mjs`, "utf8");
    const createTaskHandler = createTaskSource.slice(createTaskSource.indexOf("export const handler"));
    assert.ok(
        createTaskHandler.indexOf("await requireActivePlayer(event,")
            < createTaskHandler.indexOf("await client.send(new PutItemCommand("),
        "POST /tasks checks the active profile before writing"
    );
    assert.match(
        readFileSync(`${backend}/functions/delete-account/index.mjs`, "utf8"),
        /requireActivePlayer\(event, dynamodb, TABLE_NAME, GetItemCommand, \{ allowMissing: true \}\)/
    );
    assert.doesNotMatch(resourceBlock("CreateProfileFunction"), /ApiSharedLayer/);
    assert.doesNotMatch(resourceBlock("NotificationWorkerFunction"), /ApiSharedLayer/);
});

test("POST tasks rejects a stale JWT before any task write can run", () => {
    const source = readFileSync(`${backend}/functions/create-task/index.mjs`, "utf8");
    const handler = source.slice(source.indexOf("export const handler"));
    const guard = handler.indexOf("await requireActivePlayer(event,");
    const write = handler.indexOf("await client.send(new PutItemCommand(");

    assert.notEqual(guard, -1);
    assert.notEqual(write, -1);
    assert.ok(guard < write);
    assert.match(resourceBlock("CreateTaskFunction"), /- dynamodb:GetItem/);
});

test("HTTP authorizer uses the stack-managed Cognito resources", () => {
    assert.match(template, /EvrenthiaDevUserPool:\n    Type: AWS::Cognito::UserPool/);
    assert.match(template, /EvrenthiaDevUserPoolClient:\n    Type: AWS::Cognito::UserPoolClient/);
    assert.match(template, /PoolId:\n\s+Ref: EvrenthiaDevUserPool/);
    assert.match(template, /audience:\n\s+- Ref: EvrenthiaDevUserPoolClient/);
});

test("Cognito deletion protection is parameterized without changing identity behavior", () => {
    assert.match(
        template,
        /CognitoDeletionProtection:\n    Type: String\n    Default: INACTIVE\n    AllowedValues:\n      - ACTIVE\n      - INACTIVE/
    );

    const pool = resourceBlock("EvrenthiaDevUserPool");
    assert.match(pool, /DeletionPolicy: Retain/);
    assert.match(pool, /UpdateReplacePolicy: Retain/);
    assert.match(pool, /UserPoolName:\n\s+Fn::Sub: "\$\{FunctionNamePrefix\}-Users"/);
    assert.match(pool, /DeletionProtection:\n\s+Ref: CognitoDeletionProtection/);
    assert.match(pool, /UsernameAttributes:\n\s+- email/);
    assert.match(pool, /UsernameConfiguration:\n\s+CaseSensitive: false/);
    assert.match(pool, /AutoVerifiedAttributes:\n\s+- email/);
    assert.match(pool, /AdminCreateUserConfig:\n\s+AllowAdminCreateUserOnly: false/);
    assert.match(pool, /Schema:\n\s+- Name: email\n\s+AttributeDataType: String\n\s+Mutable: true\n\s+Required: true/);
    assert.match(pool, /MinimumLength: 8/);
    assert.match(pool, /RequireLowercase: true/);
    assert.match(pool, /RequireNumbers: true/);
    assert.match(pool, /RequireSymbols: true/);
    assert.match(pool, /RequireUppercase: true/);
    assert.match(pool, /TemporaryPasswordValidityDays: 7/);
    assert.match(pool, /LambdaConfig:\n\s+PostConfirmation:\n\s+Fn::GetAtt:\n\s+- CreateProfileFunction\n\s+- Arn/);
    assert.doesNotMatch(pool, /MfaConfiguration:/);

    const client = resourceBlock("EvrenthiaDevUserPoolClient");
    assert.match(client, /GenerateSecret: false/);
    assert.match(client, /PreventUserExistenceErrors: ENABLED/);
    assert.match(client, /ExplicitAuthFlows:\n\s+- ALLOW_USER_PASSWORD_AUTH\n\s+- ALLOW_USER_SRP_AUTH\n\s+- ALLOW_REFRESH_TOKEN_AUTH/);
    assert.match(client, /SupportedIdentityProviders:\n\s+- COGNITO/);
});

test("CreateProfile is attached to the managed pool with scoped invoke permission", () => {
    assert.match(template, /LambdaConfig:\n\s+PostConfirmation:\n\s+Fn::GetAtt:\n\s+- CreateProfileFunction\n\s+- Arn/);
    assert.match(template, /CreateProfileInvokePermission:[\s\S]*?SourceArn:\n\s+Fn::GetAtt:\n\s+- EvrenthiaDevUserPool\n\s+- Arn/);
});

test("normal development configuration does not reference manual resource identifiers", () => {
    const devConfiguration = `${template}\n${samconfig}`;
    assert.doesNotMatch(devConfiguration, /us-east-2_dP7c0zZRQ/);
    assert.doesNotMatch(devConfiguration, /6bns1m2f43bkps266bjsirha2r/);
    assert.doesNotMatch(samconfig, /TableName=|UserPoolId=|UserPoolClientId=/);
});

test("template exports isolated resource identifiers without secrets", () => {
    for (const output of [
        "ApiUrl",
        "TableName",
        "UserPoolId",
        "UserPoolClientId",
        "NotificationDeliveryMode",
        "DevApiUrl",
        "DevTableName",
        "DevUserPoolId",
        "DevUserPoolClientId",
        "CreateProfileFunctionName",
        "CreateProfileFunctionArn"
    ]) {
        assert.match(template, new RegExp(`\\n  ${output}:`));
    }
});

test("development and production SAM configurations are isolated", () => {
    const dev = configSection("default.deploy.parameters");
    const prod = configSection("prod.deploy.parameters");

    assert.match(dev, /stack_name = "evrenthia-dev"/);
    assert.match(dev, /FunctionNamePrefix=\\"Evrenthia-Dev\\"/);
    assert.match(dev, /LogRetentionDays=\\"14\\"/);
    assert.match(dev, /CognitoDeletionProtection=\\"INACTIVE\\"/);
    assert.match(prod, /stack_name = "evrenthia-prod"/);
    assert.match(prod, /s3_prefix = "evrenthia-prod"/);
    assert.match(prod, /region = "us-east-2"/);
    assert.match(prod, /confirm_changeset = true/);
    assert.match(prod, /capabilities = "CAPABILITY_IAM"/);
    assert.match(prod, /EnvironmentName=\\"prod\\"/);
    assert.match(prod, /FunctionNamePrefix=\\"Evrenthia-Prod\\"/);
    assert.match(prod, /LogRetentionDays=\\"30\\"/);
    assert.match(prod, /PushDeliveryMode=\\"DRY_RUN\\"/);
    assert.match(prod, /CognitoDeletionProtection=\\"ACTIVE\\"/);
    assert.doesNotMatch(prod, /profile\s*=|Evrenthia-Dev|evrenthia-dev/);
});

test("production uses stack-owned data and identity resources without test users", () => {
    const productionConfiguration = `${template}\n${configSection("prod.deploy.parameters")}`;
    assert.match(template, /TableName:\n\s+Ref: FunctionNamePrefix/);
    assert.match(template, /EvrenthiaDevUserPool:\n\s+Type: AWS::Cognito::UserPool/);
    assert.match(template, /EvrenthiaDevUserPoolClient:\n\s+Type: AWS::Cognito::UserPoolClient/);
    assert.doesNotMatch(template, /AWS::Cognito::UserPoolUser/);
    assert.doesNotMatch(productionConfiguration, /us-east-2_GeLguitkg|2d934f22a9lvbppn6m9liistj/);
});

test("production catalog seeding contains only static catalog records", () => {
    const allowedCatalogs = new Set(["CATALOG#COSMETICS", "CATALOG#ACHIEVEMENTS", "CATALOG#BUILDINGS"]);
    assert.equal(loadSeedItems().every((item) => allowedCatalogs.has(item.PK)), true);
});

test("GitHub workflows contain no automatic production deployment", () => {
    assert.doesNotMatch(workflows, /evrenthia-prod|Evrenthia-Prod|sam deploy|cloudformation deploy/);
});
