import { readFileSync, writeFileSync, unlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const seedDirectory = fileURLToPath(new URL(".", import.meta.url));

export function attributeValue(value) {
    if (value === null) return { NULL: true };
    if (typeof value === "string") return { S: value };
    if (typeof value === "number") return { N: String(value) };
    if (typeof value === "boolean") return { BOOL: value };
    if (Array.isArray(value)) return { L: value.map(attributeValue) };
    if (typeof value === "object") {
        return { M: Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, attributeValue(entry)])) };
    }
    throw new TypeError(`Unsupported seed value: ${String(value)}`);
}

export function loadSeedItems() {
    return ["cosmetics.json", "achievements.json", "buildings.json"]
        .flatMap((name) => JSON.parse(readFileSync(join(seedDirectory, name), "utf8")));
}

export function catalogBatches(items) {
    return Array.from({ length: Math.ceil(items.length / 25) }, (_, index) =>
        items.slice(index * 25, (index + 1) * 25));
}

function option(name) {
    const index = process.argv.indexOf(name);
    return index >= 0 ? process.argv[index + 1] : null;
}

function runBatch(tableName, items, region, profile) {
    const requestItems = {
        [tableName]: items.map((item) => ({
            PutRequest: {
                Item: Object.fromEntries(Object.entries(item).map(([key, value]) => [key, attributeValue(value)]))
            }
        }))
    };
    const requestPath = join(tmpdir(), `evrenthia-catalog-seed-${process.pid}.json`);
    writeFileSync(requestPath, JSON.stringify(requestItems));

    try {
        const args = [
            "dynamodb", "batch-write-item",
            "--request-items", `file://${requestPath}`,
            "--output", "json"
        ];
        if (region) args.push("--region", region);
        if (profile) args.push("--profile", profile);
        const result = spawnSync("aws", args, { encoding: "utf8" });
        if (result.error) {
            throw result.error;
        }
        if (result.status !== 0) {
            throw new Error(result.stderr?.trim() || "AWS CLI batch write failed");
        }
        const output = JSON.parse(result.stdout || "{}");
        const unprocessed = output.UnprocessedItems?.[tableName]?.length ?? 0;
        if (unprocessed) {
            throw new Error(`${unprocessed} catalog records were not processed; rerun the command`);
        }
    } finally {
        unlinkSync(requestPath);
    }
}

function main() {
    const tableName = option("--table");
    if (!tableName) {
        console.error("Usage: node seeds/seed-catalogs.mjs --table TABLE [--region REGION] [--profile PROFILE] [--write]");
        process.exitCode = 1;
        return;
    }

    const items = loadSeedItems();
    const counts = Object.groupBy(items, (item) => item.PK);
    console.log(`Catalog seed target: ${tableName}`);
    for (const [catalog, records] of Object.entries(counts)) {
        console.log(`  ${catalog}: ${records.length}`);
    }

    if (!process.argv.includes("--write") && !process.argv.includes("--apply")) {
        console.log("Dry run only. Add --write to write these records.");
        return;
    }

    for (const batch of catalogBatches(items)) runBatch(tableName, batch, option("--region"), option("--profile"));
    console.log(`Seeded ${items.length} catalog records into ${tableName}.`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
    main();
}
