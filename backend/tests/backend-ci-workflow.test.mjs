import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const repository = fileURLToPath(new URL("../../", import.meta.url));
const workflow = readFileSync(`${repository}/.github/workflows/backend-ci.yml`, "utf8");

test("backend CI runs local validation for pushes, pull requests, and manual dispatch", () => {
    assert.match(workflow, /^on:\n[\s\S]*?^  push:/m);
    assert.match(workflow, /^  pull_request:/m);
    assert.match(workflow, /^  workflow_dispatch:/m);
    assert.match(workflow, /backend\/\*\*/);
    assert.match(workflow, /actions\/checkout@v7/);
    assert.match(workflow, /actions\/setup-node@v7[\s\S]*?node-version: "22"/);
    assert.match(workflow, /aws-actions\/setup-sam@v3[\s\S]*?use-installer: true/);
    assert.match(workflow, /node --check/);
    assert.match(workflow, /run: node --test/);
    assert.match(workflow, /run: sam validate --lint/);
    assert.match(workflow, /run: sam build/);
    assert.match(workflow, /group: backend-ci-\$\{\{ github\.workflow \}\}-\$\{\{ github\.ref \}\}/);
    assert.match(workflow, /cancel-in-progress: true/);
});

test("deployed integration uses OIDC, environment secrets, and read-only mode", () => {
    assert.match(workflow, /environment: dev/);
    assert.match(workflow, /id-token: write/);
    assert.match(workflow, /contents: read/);
    assert.match(workflow, /aws-actions\/configure-aws-credentials@v6\.3\.0/);
    assert.match(workflow, /role-to-assume: \$\{\{ vars\.EVRENTHIA_DEV_CI_ROLE_ARN \}\}/);
    assert.match(workflow, /EVRENTHIA_TEST_EMAIL: \$\{\{ secrets\.EVRENTHIA_TEST_EMAIL \}\}/);
    assert.match(workflow, /EVRENTHIA_TEST_PASSWORD: \$\{\{ secrets\.EVRENTHIA_TEST_PASSWORD \}\}/);
    assert.match(workflow, /node scripts\/integration-test-dev\.mjs --read-only/);
    assert.match(workflow, /github\.event_name == 'workflow_dispatch'/);
    assert.match(workflow, /github\.event_name == 'push' && github\.ref == 'refs\/heads\/main'/);
});

test("backend CI contains no deployment, mutating integration, or long-lived AWS credentials", () => {
    assert.doesNotMatch(workflow, /pull_request_target/);
    assert.doesNotMatch(workflow, /--full/);
    assert.doesNotMatch(workflow, /EVRENTHIA_INTEGRATION_ALLOW_DEV_MUTATION/);
    assert.doesNotMatch(workflow, /AWS_ACCESS_KEY_ID|AWS_SECRET_ACCESS_KEY/);
    assert.doesNotMatch(workflow, /arn:aws:iam::/);
    assert.doesNotMatch(workflow, /sam deploy|cloudformation (?:deploy|create-change-set|execute-change-set)/);
});
