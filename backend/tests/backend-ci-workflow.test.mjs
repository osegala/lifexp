import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const repository = fileURLToPath(new URL("../../", import.meta.url));
const workflow = readFileSync(`${repository}/.github/workflows/backend-ci.yml`, "utf8");
const localValidation = workflow.match(/^  local-validation:[\s\S]*?(?=^  deployed-dev-read-only:)/m)?.[0] ?? "";
const deployedIntegration = workflow.match(/^  deployed-dev-read-only:[\s\S]*$/m)?.[0] ?? "";

test("backend CI runs local validation for pushes, pull requests, and manual dispatch", () => {
    assert.match(workflow, /^on:\n[\s\S]*?^  push:/m);
    assert.match(workflow, /^  pull_request:/m);
    assert.match(workflow, /^  workflow_dispatch:/m);
    assert.match(workflow, /backend\/\*\*/);
    assert.match(workflow, /actions\/checkout@v7/);
    assert.match(workflow, /actions\/setup-node@v7[\s\S]*?node-version: "22"/);
    assert.match(workflow, /aws-actions\/setup-sam@v3[\s\S]*?use-installer: true/);
    assert.match(localValidation, /defaults:\n\s+run:\n\s+working-directory: backend/);
    assert.match(localValidation, /for dir in functions layers shared seeds scripts tests/);
    assert.match(localValidation, /\[ -d "\$dir" \] \|\| continue/);
    assert.match(localValidation, /find "\$dir"[\s\S]*?node --check "\$file"/);
    assert.match(localValidation, /run: node --test/);
    assert.match(localValidation, /run: sam validate --lint/);
    assert.match(localValidation, /run: sam build/);
    assert.match(workflow, /group: backend-ci-\$\{\{ github\.workflow \}\}-\$\{\{ github\.ref \}\}/);
    assert.match(workflow, /cancel-in-progress: true/);
});

test("deployed integration uses OIDC, environment secrets, and read-only mode", () => {
    assert.match(deployedIntegration, /environment: dev/);
    assert.match(deployedIntegration, /id-token: write/);
    assert.match(deployedIntegration, /contents: read/);
    assert.match(deployedIntegration, /defaults:\n\s+run:\n\s+working-directory: backend/);
    assert.match(deployedIntegration, /aws-actions\/configure-aws-credentials@v6\.3\.0/);
    assert.match(deployedIntegration, /role-to-assume: \$\{\{ vars\.EVRENTHIA_DEV_CI_ROLE_ARN \}\}/);
    assert.match(deployedIntegration, /EVRENTHIA_TEST_EMAIL: \$\{\{ secrets\.EVRENTHIA_TEST_EMAIL \}\}/);
    assert.match(deployedIntegration, /EVRENTHIA_TEST_PASSWORD: \$\{\{ secrets\.EVRENTHIA_TEST_PASSWORD \}\}/);
    assert.match(deployedIntegration, /run: node scripts\/integration-test-dev\.mjs --read-only/);
    assert.match(deployedIntegration, /github\.event_name == 'workflow_dispatch'/);
    assert.match(deployedIntegration, /github\.event_name == 'push' && github\.ref == 'refs\/heads\/main'/);
});

test("backend CI contains no deployment, mutating integration, or long-lived AWS credentials", () => {
    assert.doesNotMatch(workflow, /pull_request_target/);
    assert.doesNotMatch(workflow, /--full/);
    assert.doesNotMatch(workflow, /EVRENTHIA_INTEGRATION_ALLOW_DEV_MUTATION/);
    assert.doesNotMatch(workflow, /AWS_ACCESS_KEY_ID|AWS_SECRET_ACCESS_KEY/);
    assert.doesNotMatch(workflow, /arn:aws:iam::/);
    assert.doesNotMatch(workflow, /sam deploy|cloudformation (?:deploy|create-change-set|execute-change-set)/);
});
