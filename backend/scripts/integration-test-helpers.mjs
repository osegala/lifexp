import { randomBytes } from "node:crypto";

const DEV_SEGMENT = /(?:^|[-_])dev(?:elopment)?(?:$|[-_])/i;
const SENSITIVE_KEY = /authorization|cookie|password|secret|token/i;

export class IntegrationAssertionError extends Error {}

export function resolveAwsProfile(environment = {}) {
    const configured = environment.EVRENTHIA_AWS_PROFILE;
    if (configured !== undefined) return configured.trim() || null;
    return environment.GITHUB_ACTIONS === "true" ? null : "evrenthia-admin";
}

export function cognitoAuthArgs({ region, clientId, email, password, profile }) {
    const args = [
        "cognito-idp", "initiate-auth",
        "--region", region,
        "--auth-flow", "USER_PASSWORD_AUTH",
        "--client-id", clientId,
        "--auth-parameters", JSON.stringify({ USERNAME: email, PASSWORD: password }),
        "--query", "AuthenticationResult.IdToken",
        "--output", "text"
    ];
    if (profile) args.push("--profile", profile);
    return args;
}

export function redactSensitive(value, secrets = []) {
    const secretValues = secrets.filter((secret) => typeof secret === "string" && secret);
    const seen = new WeakSet();
    const redacted = JSON.stringify(value, (key, entry) => {
        if (SENSITIVE_KEY.test(key)) return "[REDACTED]";
        if (entry && typeof entry === "object") {
            if (seen.has(entry)) return "[CIRCULAR]";
            seen.add(entry);
        }
        if (typeof entry !== "string") return entry;
        let text = entry
            .replace(/Bearer\s+\S+/gi, "Bearer [REDACTED]")
            .replace(/(?:Exponent|Expo)PushToken\[[^\]]+\]/gi, "[REDACTED_PUSH_TOKEN]")
            .replace(/((?:authorization|cookie|password|secret|token)\s*[:=]\s*)(?:\"[^\"]*\"|'[^']*'|[^\s,}]+)/gi, "$1[REDACTED]");
        for (const secret of secretValues) text = text.replaceAll(secret, "[REDACTED]");
        return text;
    });
    return redacted === undefined ? String(value) : redacted;
}

export function sanitizedAwsCliError(output, secrets = []) {
    return new Error(`AWS CLI failed: ${redactSensitive(output || "unknown error", secrets)}`);
}

function printable(value) {
    return redactSensitive(value).slice(0, 2_000);
}

export function assertStatus(response, expected, label = "response") {
    const statuses = Array.isArray(expected) ? expected : [expected];
    if (!statuses.includes(response?.status)) {
        throw new IntegrationAssertionError(
            `${label}: expected HTTP ${statuses.join(" or ")}, received ${response?.status ?? "no status"}; body=${printable(response?.body)}`
        );
    }
    return response;
}

export function assertEqual(actual, expected, label = "value") {
    if (!Object.is(actual, expected)) {
        throw new IntegrationAssertionError(
            `${label}: expected ${printable(expected)}, received ${printable(actual)}`
        );
    }
    return actual;
}

export function assertTruthy(value, label = "value") {
    if (!value) throw new IntegrationAssertionError(`${label}: expected a truthy value, received ${printable(value)}`);
    return value;
}

export function assertErrorCode(response, expected, label = "response") {
    return assertEqual(response?.body?.error?.code, expected, `${label} error.code`);
}

export function generateRunId(now = new Date(), random = randomBytes) {
    const timestamp = now.toISOString().replace(/[-:.TZ]/g, "");
    return `it-${timestamp}-${random(4).toString("hex")}`;
}

export function parseMode(argv = []) {
    const supported = new Set(["--read-only", "--full", "--confirm-dev"]);
    const unknown = argv.filter((argument) => !supported.has(argument));
    if (unknown.length) throw new Error(`Unknown argument${unknown.length === 1 ? "" : "s"}: ${unknown.join(", ")}`);
    if (argv.includes("--read-only") && argv.includes("--full")) {
        throw new Error("Choose either --read-only or --full, not both.");
    }
    return {
        mode: argv.includes("--full") ? "full" : "read-only",
        confirmDev: argv.includes("--confirm-dev")
    };
}

export function parseStackOutputs(value) {
    const source = typeof value === "string" ? JSON.parse(value) : value;
    if (!Array.isArray(source)) throw new Error("CloudFormation stack outputs must be an array.");
    return Object.fromEntries(source
        .filter((output) => typeof output?.OutputKey === "string" && typeof output?.OutputValue === "string")
        .map((output) => [output.OutputKey, output.OutputValue]));
}

export function assertDevTarget({ stackName, tableName, apiUrl, region, functionNames = [] }) {
    if (!DEV_SEGMENT.test(stackName ?? "")) throw new Error("Refusing non-development stack name.");
    if (!DEV_SEGMENT.test(tableName ?? "")) throw new Error("Refusing non-development table name.");

    let parsedApi;
    try {
        parsedApi = new URL(apiUrl);
    } catch {
        throw new Error("Refusing invalid API URL.");
    }
    const expectedSuffix = `.execute-api.${region}.amazonaws.com`;
    if (parsedApi.protocol !== "https:" || !parsedApi.hostname.endsWith(expectedSuffix)) {
        throw new Error("Refusing API URL that does not match the selected AWS region.");
    }
    if (!functionNames.length || functionNames.some((name) => !DEV_SEGMENT.test(name ?? ""))) {
        throw new Error("Refusing stack outputs without development-scoped Lambda names.");
    }
    return true;
}

export class CleanupStack {
    #entries = [];

    add(label, cleanup) {
        if (typeof cleanup !== "function") throw new TypeError("cleanup must be a function");
        const entry = { label, cleanup };
        this.#entries.push(entry);
        return () => {
            const index = this.#entries.indexOf(entry);
            if (index >= 0) this.#entries.splice(index, 1);
        };
    }

    get size() {
        return this.#entries.length;
    }

    async run(onError = () => {}) {
        const failures = [];
        while (this.#entries.length) {
            const entry = this.#entries.pop();
            try {
                await entry.cleanup();
            } catch (error) {
                failures.push({ label: entry.label, error });
                onError(entry.label, error);
            }
        }
        return failures;
    }
}
