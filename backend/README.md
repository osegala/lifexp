# Evrenthia SAM backend

This directory contains the repository-managed backend template for isolated environment stacks. The existing development stack is `evrenthia-dev` in `us-east-2`; the reserved production configuration targets a separate future `evrenthia-prod` stack.

Each stack owns its DynamoDB table, Cognito user pool, public app client, CreateProfile trigger, HTTP API, Lambda functions, logs, alarms, dashboard, and budget. No configuration imports, modifies, or copies another environment's users or data.

## Structure

- `template.yaml` — SAM functions, HTTP API routes, permissions, and parameters
- `functions/` — Lambda deployment code, grouped by function or notification domain
- `layers/notification-shared/` — canonical preference defaults plus dependency-free timezone scheduling shared by notification Lambdas
- `layers/progression-shared/` — canonical building-effect resolution and catalog-driven achievement evaluation
- `layers/api-shared/` — canonical Lambda-controlled HTTP responses, JSON parsing, auth-subject extraction, and safe errors
- `shared/` — small canonical helpers for auth, dates, DynamoDB values, leveling, and responses
- `seeds/` — explicit, local-only catalog data and seed command
- `tests/` — Node test runner regression tests
- `samconfig.toml` — separate development and production deployment parameters

Each function currently has its own `CodeUri`. Cross-function runtime logic therefore uses explicit SAM layers; repository-only helpers under `shared/` are not imported by Lambda artifacts.

## Local verification

Run from `backend/`:

```sh
sam validate --lint --template-file template.yaml
sam build --template-file template.yaml
node --test
```

Static syntax checks can be run with:

```sh
find functions layers shared seeds scripts tests -name '*.mjs' -exec node --check {} \;
```

## Development integration tests

`node --test` is the isolated unit/regression suite and never requires AWS. `scripts/integration-test-dev.mjs` is a separate end-to-end runner for the already deployed `evrenthia-dev` stack. It uses Node's built-in `fetch` plus the installed AWS CLI; it does not deploy, update CloudFormation, seed catalogs, or target manually managed resources.

The runner discovers `DevApiUrl`, `DevTableName`, `DevUserPoolId`, and `DevUserPoolClientId` from CloudFormation stack outputs, then authenticates a dedicated Cognito test user with `USER_PASSWORD_AUTH`. Credentials must be supplied only through these environment variables and are redacted from errors:

- `EVRENTHIA_TEST_EMAIL`
- `EVRENTHIA_TEST_PASSWORD`

Defaults are stack `evrenthia-dev`, region `us-east-2`, and profile `evrenthia-admin`. They can be overridden with `EVRENTHIA_STACK_NAME`, `EVRENTHIA_AWS_REGION`, and `EVRENTHIA_AWS_PROFILE`, but the runner refuses targets whose stack, table, API region, and Lambda output names do not all look development-scoped.

Read-only mode covers authentication, `/me`, tasks, goals, aggregate history, achievements, shop, inventory, world, preferences, and non-mutating auth/validation error cases:

```sh
EVRENTHIA_TEST_EMAIL="test-user@example.com" \
EVRENTHIA_TEST_PASSWORD="replace-locally" \
node scripts/integration-test-dev.mjs --read-only
```

Full mode adds disposable task CRUD/completion/archive checks, duplicate-reward protection, immutable completion history, reversible preference changes, reminder idempotency/update/disable, and cleanup. It requires a second explicit development-mutation confirmation:

```sh
EVRENTHIA_TEST_EMAIL="test-user@example.com" \
EVRENTHIA_TEST_PASSWORD="replace-locally" \
EVRENTHIA_INTEGRATION_ALLOW_DEV_MUTATION=true \
node scripts/integration-test-dev.mjs --full
```

`--confirm-dev` may be used instead of `EVRENTHIA_INTEGRATION_ALLOW_DEV_MUTATION=true`. Set `EVRENTHIA_INTEGRATION_SKIP_MUTATING_COMPLETION=true` to skip the progression-changing completion assertions while retaining the reversible full-mode checks. With no mode flag, the runner defaults to read-only.

Full mode archives its disposable tasks, soft-disables its reminder and deterministic per-user integration device, and restores `soundEnabled` in `finally` cleanup. Fake Expo device registration runs only when the deployed NotificationWorker reports `PUSH_DELIVERY_MODE=DRY_RUN`. Task completion cannot be rolled back: it permanently increments the dedicated test user's XP, coins, task count, daily/weekly statistics, completion history, possible World Points, and possible achievements. Shop purchases and building upgrades are deliberately not exercised because they are durable and lack safe cleanup.

From the repository root, the equivalent package scripts are `npm test`, `npm run test:integration:dev:read-only`, and `npm run test:integration:dev`. The latter selects full mode and still requires explicit mutation confirmation.

For future CI, store the email and password as protected secrets and call read-only mode first. AWS authentication should use GitHub OIDC with a narrowly scoped role; do not store long-lived AWS access keys in the repository or workflow configuration. A deployment workflow is intentionally not included yet.

## Backend continuous integration

`.github/workflows/backend-ci.yml` runs for backend-related pushes and pull requests, and can also be started with **Actions → Backend CI → Run workflow**. Every run checks all `.mjs` syntax, runs `node --test`, validates the SAM template with linting, and builds it on Ubuntu with Node.js 22 and the supported AWS SAM CLI installer. The backend currently has no local npm dependencies to install; add a backend lockfile and `npm ci` if that changes.

The deployed DEV read-only job runs only after local validation on pushes to `main` or manual dispatch. It never runs for pull requests, uses the GitHub `dev` environment, and always invokes `node scripts/integration-test-dev.mjs --read-only`. Full integration remains manual because task completion permanently changes the dedicated test user's progression.

Configure GitHub as follows:

1. In **Repository Settings → Environments → dev**, add environment secrets `EVRENTHIA_TEST_EMAIL` and `EVRENTHIA_TEST_PASSWORD`. Optional deployment reviewers can gate manual access to this environment.
2. In **Repository Settings → Environments → dev → Environment variables**, add `EVRENTHIA_DEV_CI_ROLE_ARN` with the ARN of `Evrenthia-Dev-GitHub-CI`.
3. In AWS, configure GitHub's OIDC provider and restrict the role trust policy to this repository, audience `sts.amazonaws.com`, and the `dev` environment subject. The workflow requests only `contents: read` and `id-token: write`, then exchanges the GitHub OIDC token for short-lived role credentials. Do not create or store AWS access keys.

The read-only runner makes exactly one IAM-authorized AWS application call: `cloudformation:DescribeStacks` for `evrenthia-dev`. The role's identity policy can therefore be limited to:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": "cloudformation:DescribeStacks",
      "Resource": "arn:aws:cloudformation:us-east-2:<ACCOUNT_ID>:stack/evrenthia-dev/*"
    }
  ]
}
```

The runner also calls Cognito `InitiateAuth`, but Cognito does not evaluate IAM policies for that public user-pool operation; adding `cognito-idp:InitiateAuth` to the role has no effect. Authentication is controlled by the development app client and dedicated user's credentials. Read-only API requests use the resulting Cognito ID token, not IAM authorization. The role needs no DynamoDB, Lambda, IAM, CloudFormation mutation, or deployment permissions.

GitHub Actions supplies ambient OIDC credentials, so the runner omits `--profile` when `GITHUB_ACTIONS=true`. Local runs still default to `evrenthia-admin`; set `EVRENTHIA_AWS_PROFILE` to another name, or to an empty string to use local ambient credentials.

To reproduce required CI validation locally from `backend/`:

```sh
find functions layers shared seeds scripts tests -name '*.mjs' -exec node --check {} \;
node --test
sam validate --lint
sam build
```

## Environment parameters

The template accepts:

- `EnvironmentName` — logical environment name; current value is `dev`
- `FunctionNamePrefix` — physical resource prefix; current value is `Evrenthia-Dev`
- `LogRetentionDays` — environment-specific CloudWatch Logs retention; dev uses 14 and prod is configured for 30
- `PushDeliveryMode` — `DRY_RUN` or `LIVE`; the template and both environment configs default explicitly to `DRY_RUN`
- `CognitoDeletionProtection` — `ACTIVE` or `INACTIVE`; dev explicitly remains `INACTIVE`, while production is configured `ACTIVE`
- `BudgetNotificationEmail` — optional budget subscriber; empty by default

The stack creates its table from `FunctionNamePrefix`. Every Lambda receives that table through `TABLE_NAME`, every DynamoDB policy references the managed table ARN, and the HTTP authorizer resolves its issuer and audience from the same stack's Cognito pool and client. Physical Lambda, layer, log-group, EventBridge-rule, alarm, dashboard, and budget names also use the prefix. CloudFormation logical IDs retain `Dev` solely to avoid replacing existing development resources; they do not control physical production names.

A normal development deployment command is:

```sh
sam deploy --config-env default
```

Do not run that command unless deployment is intended and the changeset has been reviewed.

To create a reviewable CloudFormation change set without executing it:

```sh
sam deploy --config-env default --no-execute-changeset
```

The `[prod]` SAM configuration reserves stack `evrenthia-prod`, prefix/table `Evrenthia-Prod`, region `us-east-2`, 30-day log retention, `DRY_RUN` notifications, and `ACTIVE` Cognito deletion protection. It contains no AWS profile or credentials; a future operator must deliberately select approved production credentials through local SSO/profile configuration or another short-lived credential source.

Production Cognito deletion protection helps prevent accidental direct deletion of the user pool. Disabling or deleting that pool should require a deliberate configuration change to `CognitoDeletionProtection=INACTIVE` first. This guardrail does not replace backups or broader identity-data retention and recovery planning.

## Production deployment checklist

Production deployment is not performed or automated by this repository phase. The following is documentation for a future deliberate production release:

1. Review `git status --short` and confirm the intended revision is clean and reviewed.
2. From `backend/`, run `node --test`.
3. Run `sam validate --lint --config-env prod --template-file template.yaml`.
4. Run `sam build --config-env prod --template-file template.yaml`.
5. Review `[prod.deploy.parameters]`, especially `EnvironmentName=prod`, `FunctionNamePrefix=Evrenthia-Prod`, `LogRetentionDays=30`, `PushDeliveryMode=DRY_RUN`, `CognitoDeletionProtection=ACTIVE`, the region, budget email, alarm thresholds, and schedule.
6. **Documentation only—do not run during repository preparation:** use `sam deploy --config-env prod --no-execute-changeset` to create a reviewable production change set without executing it. Do not approve unexpected changes.
7. Verify every proposed table, function, layer, log group, schedule, alarm, dashboard, and budget name is production-specific.
8. Verify the change set updates the existing stack-owned production Cognito pool in place to deletion protection `ACTIVE`, creates no replacement pool or app client, and references no development IDs or users.
9. Verify it creates the separate `Evrenthia-Prod` DynamoDB table and contains no import or data-copy resource.
10. Verify `NotificationWorker` receives `PUSH_DELIVERY_MODE=DRY_RUN` before any execution is approved.
11. After the backend is verified, preview only the static catalog seed with `node seeds/seed-catalogs.mjs --table Evrenthia-Prod --region us-east-2 --profile <production-profile>`. Inspect the cosmetics, achievements, and buildings counts before a separately approved `--write`; never seed profiles, tasks, history, devices, reminders, entitlements, or test records.
12. Only after the production Cognito pool exists, deliberately create a dedicated production smoke-test account. Do not copy or reuse the development integration user. Supply its credentials through `EVRENTHIA_PROD_TEST_EMAIL` and `EVRENTHIA_PROD_TEST_PASSWORD` locally, or future protected production GitHub environment secrets, then manually run `node scripts/integration-test-prod.mjs --read-only`. The runner never creates users or performs writes.
13. Reconnect the production mobile configuration only after the API URL, new Cognito pool/client, table, notification mode, and read-only smoke-test results are verified.

The generic `ApiUrl`, `TableName`, `UserPoolId`, and `UserPoolClientId` outputs support future production verification. Existing `Dev*` output aliases remain only for backward compatibility with the green development integration runner.

AWS Budgets are account-wide. Although the production budget name resolves separately as `Evrenthia-Prod-Monthly-10-USD`, without activated cost-allocation tags or a separate AWS account it observes total account cost rather than only production resources. Review whether the $10 limit and notifications are appropriate before deployment.

### Production read-only smoke test

`scripts/integration-test-prod.mjs` is reserved for manual use after `evrenthia-prod` and its dedicated smoke-test account exist. It accepts no mutation mode and calls only GET endpoints: profile, tasks, goals, aggregate and completion history, achievements, shop, inventory, world, entitlements, preferences, devices, and reminders. Empty/default account state and unseeded catalogs are valid.

The runner uses CloudFormation only to describe `evrenthia-prod`, then requires generic outputs for `Evrenthia-Prod`, the production API, a new regional Cognito pool/client, and production-prefixed Lambda names. It rejects development or unknown stacks and known non-production Cognito resources. Cognito authentication uses the supplied account credentials; passwords, ID tokens, and authorization headers are redacted and never printed. `EVRENTHIA_PROD_AWS_PROFILE` may select an approved local production profile; when omitted, AWS CLI ambient credentials are used.

Example for future manual use only, after production exists:

```sh
EVRENTHIA_PROD_TEST_EMAIL="smoke-account@example.com" \
EVRENTHIA_PROD_TEST_PASSWORD="supply-securely" \
EVRENTHIA_PROD_AWS_PROFILE="approved-production-profile" \
node scripts/integration-test-prod.mjs --read-only
```

Do not run this runner to create the account, seed catalogs, or prepare data. No production CI job is configured; if one is added later, store credentials in a protected production GitHub environment and retain the read-only-only contract.

## Managed development resources

- DynamoDB table: `Evrenthia-Dev`, on-demand billing, `PK`/`SK` string key, retained on deletion or replacement
- Cognito user pool: `Evrenthia-Dev-Users`, email sign-in and verification, self-registration enabled
- Cognito app client: public client without a secret; password, SRP, and refresh-token flows enabled
- HTTP API: JWT issuer and audience reference the managed pool and client
- CreateProfile: automatically wired to the managed pool's PostConfirmation trigger

`CreateProfileFunction` writes a default `PROFILE` item with a conditional write. Replayed Cognito events cannot overwrite an existing profile. Cognito invoke permission and PostConfirmation wiring are owned by this stack.

The stack does not import or adopt the existing manually managed table, user pool, app client, or their data. No automatic data migration is performed.

## Observability and cost protection

All 30 development Lambdas use Lambda's native JSON log format at application level `INFO` and system level `WARN`. Unexpected API failures emit a stable `UNEXPECTED_ERROR` record with the function name and sanitized error metadata; Lambda adds the invocation request ID to its JSON envelope. CreateProfile and NotificationWorker emit the same safe metadata shape without logging Cognito events, request bodies, authorization values, JWTs, push tokens, or DynamoDB items. Expected API 4xx responses are not logged as errors.

CloudFormation declares the standard `/aws/lambda/Evrenthia-Dev-<Function>` log group for every public API Lambda, CreateProfile, and NotificationWorker with 14-day retention. The log-group resources use `DeletionPolicy: Retain`, but retained events still expire after 14 days. Existing Lambda-created groups cannot be adopted by a normal stack update. The import stage below safely imports the 25 groups found in AWS; five functions have not created a group yet and their groups are deferred to the later normal observability update.

### Existing log-group import stage

The import artifacts are [cloudformation/log-group-import-template.yaml](cloudformation/log-group-import-template.yaml) and [cloudformation/log-group-imports.json](cloudformation/log-group-imports.json). The template is a snapshot of CloudFormation's currently deployed original template plus only the existing retained log groups. It intentionally excludes Lambda `LoggingConfig`, alarms, the dashboard, the budget, and the five nonexistent groups. The mapping has 25 entries because the read-only inventory found these expected groups missing:

- `/aws/lambda/Evrenthia-Dev-DisableDevice`
- `/aws/lambda/Evrenthia-Dev-UpdateReminder`
- `/aws/lambda/Evrenthia-Dev-DeleteReminder`
- `/aws/lambda/Evrenthia-Dev-EquipItem`
- `/aws/lambda/Evrenthia-Dev-UnequipItem`

There were no unexpected groups under the `/aws/lambda/Evrenthia-Dev-` prefix. Regenerate the artifacts after any deployed stack change with `node scripts/prepare-log-group-import.mjs`; it uses only `get-template` and `describe-log-groups` AWS reads.

From `backend/`, manually create and inspect the import change set:

```sh
aws cloudformation create-change-set \
  --stack-name evrenthia-dev \
  --change-set-name evrenthia-log-group-import \
  --change-set-type IMPORT \
  --template-body file://cloudformation/log-group-import-template.yaml \
  --resources-to-import file://cloudformation/log-group-imports.json \
  --parameters ParameterKey=EnvironmentName,UsePreviousValue=true ParameterKey=FunctionNamePrefix,UsePreviousValue=true \
  --capabilities CAPABILITY_IAM \
  --profile evrenthia-admin \
  --region us-east-2

aws cloudformation wait change-set-create-complete \
  --stack-name evrenthia-dev \
  --change-set-name evrenthia-log-group-import \
  --profile evrenthia-admin \
  --region us-east-2

aws cloudformation describe-change-set \
  --stack-name evrenthia-dev \
  --change-set-name evrenthia-log-group-import \
  --query 'Changes[].ResourceChange.{Action:Action,LogicalId:LogicalResourceId,Type:ResourceType,Replacement:Replacement}' \
  --output table \
  --profile evrenthia-admin \
  --region us-east-2
```

The preview must contain exactly 25 `Import` actions for `AWS::Logs::LogGroup` and no Add, Modify, or Remove actions. Only after that manual review, execute and wait:

```sh
aws cloudformation execute-change-set \
  --stack-name evrenthia-dev \
  --change-set-name evrenthia-log-group-import \
  --profile evrenthia-admin \
  --region us-east-2

aws cloudformation wait stack-import-complete \
  --stack-name evrenthia-dev \
  --profile evrenthia-admin \
  --region us-east-2

DRIFT_DETECTION_ID=$(aws cloudformation detect-stack-drift \
  --stack-name evrenthia-dev \
  --query StackDriftDetectionId \
  --output text \
  --profile evrenthia-admin \
  --region us-east-2)

while true; do
  DRIFT_STATUS=$(aws cloudformation describe-stack-drift-detection-status \
    --stack-drift-detection-id "$DRIFT_DETECTION_ID" \
    --query DetectionStatus \
    --output text \
    --profile evrenthia-admin \
    --region us-east-2)
  echo "$DRIFT_STATUS"
  [ "$DRIFT_STATUS" = DETECTION_COMPLETE ] && break
  [ "$DRIFT_STATUS" = DETECTION_FAILED ] && exit 1
  sleep 5
done

aws cloudformation describe-stack-resource-drifts \
  --stack-name evrenthia-dev \
  --stack-resource-drift-status-filters MODIFIED DELETED \
  --profile evrenthia-admin \
  --region us-east-2
```

Resource import records desired properties but does not modify the live groups. The inventory showed no existing `retentionInDays` value, so drift detection may initially report the imported groups as modified against the desired 14 days. Do not assume import applied retention; the subsequent observability change set must be reviewed for the retention update, and a separate drift-repair update is required if it does not include one.

After a successful import, return to the full `template.yaml`, run `sam validate --lint`, `sam build`, and `node --test`, then run `sam deploy --config-env default --profile evrenthia-admin --region us-east-2 --no-execute-changeset`. Review that normal change set for the five missing log-group additions plus the intended JSON logging configuration, alarms, dashboard, budget, and retention handling. Execute it only after that review.

The dev stack defines seven alarms, all with `TreatMissingData=notBreaching` and no SNS or email actions:

| Alarm | Threshold |
| --- | --- |
| HTTP API 5xx | 5 errors in 5 minutes |
| CompleteTask Lambda errors | 3 errors in 5 minutes |
| PurchaseItem Lambda errors | 3 errors in 5 minutes |
| UpgradeBuilding Lambda errors | 3 errors in 5 minutes |
| NotificationWorker Lambda errors | 3 errors in 5 minutes |
| CreateProfile Lambda errors | 3 errors in 5 minutes |
| DynamoDB throttled requests | 1 throttle in 5 minutes |

The single `Evrenthia-Dev` dashboard shows API requests/4xx/5xx, errors for the three transaction Lambdas and NotificationWorker, NotificationWorker average duration, and DynamoDB throttles. There is no duration alarm: duration remains visible without creating a noisy dev alert. `SKIPPED` notification records and zero processed notifications do not affect the Lambda error metric.

Useful read-only commands:

```sh
aws cloudwatch describe-alarms --alarm-name-prefix Evrenthia-Dev --region us-east-2 --profile evrenthia-admin
aws cloudwatch get-dashboard --dashboard-name Evrenthia-Dev --region us-east-2 --profile evrenthia-admin
aws logs tail /aws/lambda/Evrenthia-Dev-CompleteTask --since 1h --region us-east-2 --profile evrenthia-admin
aws logs tail /aws/lambda/Evrenthia-Dev-NotificationWorker --since 1h --region us-east-2 --profile evrenthia-admin
```

`Evrenthia-Dev-Monthly-10-USD` is a $10 monthly AWS Budget for total account cost. It is intentionally account-wide because this stack does not yet have a complete activated cost-allocation-tag strategy. The optional `BudgetNotificationEmail` parameter defaults to empty, so no personal address is stored and no email subscribers are configured unless an operator supplies one. When supplied, actual-cost notifications are configured at 50%, 80%, and 100%.

The NotificationWorker keeps the existing EventBridge schedule without a DLQ. EventBridge already retries failed target deliveries, the generic minute tick contains no business payload worth replaying, and worker processing is claim-protected and idempotent. Uncaught invocation failures feed the Lambda error alarm; isolated occurrence failures produce structured `NOTIFICATION_OCCURRENCE_FAILED` logs. Add an SQS DLQ in production if repeated delivery failures require durable forensic capture or replay.

These settings are deliberately development-sized. Production should choose retention from compliance needs, connect alarms to an owned notification/on-call channel, tune thresholds from actual traffic, evaluate an SQS failure destination, and use activated cost-allocation tags or separate accounts for workload-specific budgets.

## Task archive and history

`DELETE /tasks/{taskId}` is non-destructive. It keeps the task item and sets `archived=true`, `archivedAt`, `active=false`, and `updatedAt`. Repeating the delete is safe and preserves the original archive timestamp. Archived tasks are excluded from `GET /tasks` and its summary by default; `GET /tasks?includeArchived=true` includes them. Archived tasks cannot be edited or completed.

`GET /history` remains the 30-day aggregate daily-statistics endpoint. `GET /history/completions` returns immutable task-completion snapshots newest first, with a default limit of 50 and optional `limit`, `before`, `taskId`, and `cursor` query parameters.

Every completion transaction writes `USER#<sub> / COMPLETION_HISTORY#<timestamp>#<completionId>` with the task title, description, repeat schedule, timezone, rewards, and resulting streaks. Recurring tasks continue to use `COMPLETION#<taskId>#<localDate>` as a separate duplicate-completion guard. Both records are committed atomically with the task, profile, stats, goal rewards, and achievements.

## Subscription and ad entitlements

`GET /entitlements` reads `USER#<sub> / ENTITLEMENTS` and returns only the effective `plan`, `subscriptionStatus`, `adsEnabled`, `expiresAt`, and `autoRenew` values. Missing records are FREE with ads enabled. PREMIUM records disable ads only while their server-evaluated status and expiration allow access; expired or malformed data fails safely to FREE. A canceled subscription retains premium access through a valid future expiration, but does not auto-renew.

The client is never authoritative for plan, status, expiration, or ad behavior. In particular, stored or client-provided `adsEnabled` values do not decide access; the API derives it from trusted entitlement state. `CreateProfile` intentionally does not create an entitlement record.

Development entitlements can be previewed locally with the guarded admin script:

```sh
node scripts/set-dev-entitlement.mjs --table Evrenthia-Dev --user-sub <sub> --plan PREMIUM --region us-east-2 --profile evrenthia-admin
```

Add `--write` only when an intentional development-table update is wanted. Use `--plan FREE` to reset the same stable `USER#<sub> / ENTITLEMENTS` record. The script requires explicit table, user, plan, region, and profile values, defaults to a dry run, refuses table names without a clear `dev` or `development` segment, and stores no credentials.

A future trusted billing ingestion service should validate Apple App Store Server Notifications or Google Play purchase notifications, then update the same `ENTITLEMENTS` item. No public webhook, receipt-validation endpoint, or client-controlled premium mutation is included yet.

## Preferences, devices, and reminders

User preferences are stored at `USER#<sub> / PREFERENCES`. Missing records resolve to notification defaults, so `CreateProfile` does not create one. `GET /preferences` returns resolved values and `PATCH /preferences` accepts only the documented boolean settings and a nullable local `HH:MM` daily-reminder time. It never reads or writes a timezone; `PROFILE.timeZone` remains authoritative.

Push devices use `USER#<sub> / DEVICE#<deviceId>`. The initial provider is Expo, with iOS and Android support. Registering the same stable device ID refreshes its token while preserving `createdAt`. Deletes only set `enabled=false`. Full push tokens are write-only from the API consumer's perspective and are never returned by `GET /devices`.

The single global daily reminder exists only on `USER#<sub> / PREFERENCES`, using `dailyReminderEnabled` and `dailyReminderTime`. `POST /reminders` rejects `DAILY`; persisted `REMINDER#` items are TASK-only. Task reminders can only reference an owned, active, non-archived task. An optional 8–128 character `clientRequestId` creates a deterministic reminder key scoped by user, so a retried create returns the original record instead of creating a duplicate.

Enabled daily and task configurations receive sparse `GSI1PK=NOTIFICATION_DUE`, `GSI1SK=<nextDueAt>#<identifier>` attributes in `NotificationDueIndex`. Disabling a configuration removes those fields. `nextDueAt` is calculated from local wall-clock time using `PROFILE.timeZone`; offsets are resolved with `Intl`, nonexistent spring-forward times skip to the next configured local day, and repeated fall-back times use the first occurrence. `PATCH /me` uses lazy timezone repair: the worker revalidates the current profile timezone before every attempt and replaces a stale due time without sending. This is safe but can delay the first reminder after a timezone change until the old index time becomes due.

One development-scoped EventBridge rule invokes `NotificationWorker` every minute. The worker queries at most 25 due index entries—never a table scan—then conditionally claims each occurrence, reloads the profile, preferences, task, and enabled devices, prepares delivery records, and conditionally advances `nextDueAt`. Archived, inactive, disabled, stale, or device-less attempts are recorded as `SKIPPED`. Conditional occurrence claims prevent overlapping workers from processing the same due key.

Delivery history uses `USER#<sub> / NOTIFICATION_DELIVERY#<timestamp>#<deliveryId>` with notification, reminder, task, device, provider, status, local-date, and sanitized error metadata. Push tokens are never copied into delivery history or returned by APIs. Statuses are `PREPARED`, `SENT`, `FAILED`, and `SKIPPED`.

The Expo provider defaults to `PUSH_DELIVERY_MODE=DRY_RUN`, which prepares records without any network request. `LIVE` enables the centralized Expo HTTP call. The schedule remains one worker rule for the whole dev backend; there are no per-user or per-reminder EventBridge resources.

Adding `NotificationDueIndex` is an in-place DynamoDB table update that triggers an online GSI backfill. The table is retained and its `PK`/`SK` are unchanged, but a future deployment should review the CloudFormation changeset and monitor index creation before relying on the worker.

## Catalog seeding

The seed command requires an explicit table name and is a dry run unless `--write` is present. It uses the installed AWS CLI and contains no credentials.

Preview:

```sh
node seeds/seed-catalogs.mjs --table Evrenthia-Dev --region us-east-2 --profile evrenthia-admin
```

Apply intentionally:

```sh
node seeds/seed-catalogs.mjs --table Evrenthia-Dev --region us-east-2 --profile evrenthia-admin --write
```

Batch writes use stable `PK`/`SK` keys, so reruns replace the same logical catalog records rather than creating duplicates. They are never run by `sam build` or `sam deploy`.

The initial static catalog contains 2 cosmetics (`starter_tunic` and `forest_tunic`), 11 achievements, and 6 buildings: 19 records total. Temporary `sam_test_*` records are not included. Achievement thresholds and building upgrade costs reflect the established backend contract.

## API errors and validation

Lambda-controlled failures use one JSON envelope:

```json
{
  "error": {
    "code": "TASK_NOT_FOUND",
    "message": "Task not found."
  }
}
```

`details` is omitted unless structured field or business context is useful. Clients should branch on stable `error.code` values and use `error.message` only as a user-friendly fallback. Validation and malformed input use 400; missing Lambda authentication uses 401; authorization failures use 403; missing owned resources use 404; duplicate or stale state uses 409; and unexpected failures use a sanitized 500 `INTERNAL_ERROR`. JSON responses include `Content-Type: application/json`; 204 responses have no body.

Mutable endpoints reject unsupported fields. Task rewards/completion/streaks, profile progression, shop pricing and unlocks, building costs/effects/levels, equipment categories, and achievements remain server-authoritative. Malformed JSON is always `INVALID_JSON`; field validation uses `VALIDATION_ERROR` or a more specific stable domain code such as `INVALID_REPEAT_TYPE`, `INVALID_TIME_ZONE`, or `INSUFFICIENT_COINS`.

The shared handler boundary logs unexpected exceptions internally without returning stack traces, AWS errors, table names, tokens, DynamoDB expressions, or other implementation details. Expected 4xx validation and business errors are returned without noisy exception logging. Authentication failures rejected by API Gateway before Lambda invocation may retain API Gateway's native response shape; normalizing those would require a separate gateway-level architecture change.

## Building effects and progression

Building effects are trusted catalog data under `CATALOG#BUILDINGS`. Each building uses an `effectsByLevel` array whose entries contain a numeric level and inert `{ "type", "value" }` records. Unknown types are ignored; catalog values are never evaluated as code. A missing user `BUILDING#<buildingId>` record means level 1.

| Building | Gameplay role | Level 1–5 values |
| --- | --- | --- |
| Home Base | World-area unlock metadata | Areas 1, 2, 3, 4, 5 |
| Workshop | Cosmetic shop discount | 0%, 2%, 4%, 7%, 10% |
| Library | Cosmetic level-requirement reduction | 0, 0, 1, 1, 2 levels |
| Training Grounds | Task XP bonus | 0%, 2%, 5%, 8%, 10% |
| Garden | Task coin bonus | 0%, 2%, 5%, 8%, 10% |
| Hall of Achievements | Achievement display capacity metadata | 3, 5, 7, 10, 15 slots |

`WORLD_AREA_UNLOCK` and `ACHIEVEMENT_DISPLAY_SLOTS` are display/unlock metadata in v1. `PET_SLOTS` is supported by the resolver but has no seeded building effect yet. Flat daily and weekly World Point bonus types are also supported but currently unseeded.

Task bonuses use `floor(baseReward × bonusPercent / 100)`. The stored task `xpReward` and `coinReward` remain unchanged base values; profile totals, daily/weekly statistics, and completion history receive the actual base-plus-bonus totals. Existing `rewards.xp` and `rewards.coins` response fields remain total awards, with additive `base`, `bonuses`, and `total` detail.

Shop pricing uses `floor(catalogPrice × (100 − discountPercent) / 100)`. `GET /shop` returns both `price` and `effectivePrice`; purchase recalculates the offer from the building catalog. Library reductions produce `effectiveRequiredLevel`, never below 1, while achievement requirements are unchanged.

The shared achievement engine supports `TASKS_COMPLETED`, `LEVEL_REACHED`, `COINS_OWNED`, `STREAK_REACHED`, `WORLD_POINTS_OWNED`, `BUILDING_LEVEL_REACHED`, `TOTAL_BUILDING_LEVELS`, `COSMETICS_OWNED`, and `ACHIEVEMENTS_EARNED`. Building-specific records use `targetBuildingId`. CompleteTask, UpgradeBuilding, and PurchaseItem evaluate only event-relevant catalog types and write new awards in the same transaction as progression. Achievement-count chaining is deterministic and bounded by the active catalog size. Unknown types report zero unsupported progress and never unlock.

All rewards, discounts, requirements, effects, progress values, and unlocks are resolved server-side. Client-supplied progression fields do not participate in these decisions.
