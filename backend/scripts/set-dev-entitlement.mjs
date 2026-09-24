import { spawnSync } from "node:child_process";
import { writeFileSync, unlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const REQUIRED_OPTIONS = ["--table", "--user-sub", "--plan", "--region", "--profile"];

function option(argv, name) {
    const index = argv.indexOf(name);
    const value = index >= 0 ? argv[index + 1] : null;
    return value && !value.startsWith("--") ? value : null;
}

export function isDevelopmentTable(tableName) {
    if (typeof tableName !== "string") return false;

    const parts = tableName.split(/[^a-z0-9]+/i);
    return parts.some((part) => /^(dev|development)$/i.test(part))
        && !parts.some((part) => /^(prod|production|live)$/i.test(part));
}

export function parseOptions(argv) {
    const values = Object.fromEntries(REQUIRED_OPTIONS.map((name) => [name, option(argv, name)]));
    const missing = REQUIRED_OPTIONS.filter((name) => !values[name]);
    if (missing.length) {
        throw new Error(`Missing required option${missing.length === 1 ? "" : "s"}: ${missing.join(", ")}`);
    }

    if (!isDevelopmentTable(values["--table"])) {
        throw new Error(`Refusing non-development table: ${values["--table"]}`);
    }

    const plan = values["--plan"].toUpperCase();
    if (!new Set(["FREE", "PREMIUM"]).has(plan)) {
        throw new Error("--plan must be FREE or PREMIUM");
    }

    return {
        tableName: values["--table"],
        userSub: values["--user-sub"],
        plan,
        region: values["--region"],
        profile: values["--profile"],
        write: argv.includes("--write")
    };
}

export function entitlementItem(userSub, plan, now = new Date()) {
    const timestamp = now.toISOString();
    const premium = plan === "PREMIUM";
    const item = {
        PK: { S: `USER#${userSub}` },
        SK: { S: "ENTITLEMENTS" },
        plan: { S: plan },
        subscriptionStatus: { S: premium ? "ACTIVE" : "FREE" },
        adsEnabled: { BOOL: !premium },
        provider: { S: "DEVELOPMENT" },
        autoRenew: { BOOL: false },
        updatedAt: { S: timestamp }
    };

    if (premium) {
        item.productId = { S: "evrenthia.premium.dev" };
        item.startedAt = { S: timestamp };
    }

    return item;
}

function putEntitlement(options, item) {
    const itemPath = join(tmpdir(), `evrenthia-dev-entitlement-${process.pid}.json`);
    writeFileSync(itemPath, JSON.stringify(item));

    try {
        const result = spawnSync("aws", [
            "dynamodb", "put-item",
            "--table-name", options.tableName,
            "--item", `file://${itemPath}`,
            "--region", options.region,
            "--profile", options.profile,
            "--output", "json"
        ], { encoding: "utf8" });

        if (result.error) throw result.error;
        if (result.status !== 0) {
            throw new Error(result.stderr?.trim() || "AWS CLI put-item failed");
        }
    } finally {
        unlinkSync(itemPath);
    }
}

function main() {
    let options;
    try {
        options = parseOptions(process.argv.slice(2));
    } catch (error) {
        console.error(error.message);
        console.error("Usage: node scripts/set-dev-entitlement.mjs --table DEV_TABLE --user-sub SUB --plan FREE|PREMIUM --region REGION --profile PROFILE [--write]");
        process.exitCode = 1;
        return;
    }

    const item = entitlementItem(options.userSub, options.plan);
    console.log(JSON.stringify({
        mode: options.write ? "write" : "dry-run",
        tableName: options.tableName,
        item
    }, null, 2));

    if (!options.write) {
        console.log("Dry run only. Add --write to update the development entitlement.");
        return;
    }

    putEntitlement(options, item);
    console.log(`Updated ${options.userSub} to ${options.plan} in ${options.tableName}.`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
    main();
}
