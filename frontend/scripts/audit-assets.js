/* global __dirname, Buffer */
const fs = require("node:fs");
const path = require("node:path");
const zlib = require("node:zlib");

const frontendRoot = path.resolve(__dirname, "..");
const repositoryRoot = path.resolve(frontendRoot, "..");
const assetsRoot = path.join(frontendRoot, "assets");
const reportPath = path.join(assetsRoot, "ASSET_INVENTORY.md");
const avatarRegistryPath = path.join(frontendRoot, "src/avatar/assetRegistry.ts");
const inventoryPath = path.join(frontendRoot, "src/avatar/inventory.ts");
const mapRegistryPath = path.join(frontendRoot, "src/base/mapAssetRegistry.ts");
const buildingRegistryPath = path.join(frontendRoot, "src/base/buildingAssetRegistry.ts");
const cosmeticsPath = path.join(repositoryRoot, "backend/seeds/cosmetics.json");

const imageFiles = findFiles(assetsRoot)
  .filter((file) => file.toLowerCase().endsWith(".png"))
  .sort();
const sourceFiles = [
  ...findCodeFiles(path.join(frontendRoot, "app")),
  ...findCodeFiles(path.join(frontendRoot, "src")),
];
const staticReferences = collectStaticImageReferences(sourceFiles);
const appReferences = collectAppImageReferences(path.join(frontendRoot, "app.json"));
const referencedFiles = new Set([...staticReferences, ...appReferences]);
const avatarRegistry = fs.readFileSync(avatarRegistryPath, "utf8");
const mapRegistry = fs.readFileSync(mapRegistryPath, "utf8");
const buildingRegistry = fs.readFileSync(buildingRegistryPath, "utf8");
const cosmeticKeys = objectKeysBetween(
  avatarRegistry,
  "const COSMETIC_ASSETS",
  "export const DEFAULT_CHARACTER_SPRITES",
);

const failures = [];
for (const file of referencedFiles) {
  if (!fs.existsSync(file)) failures.push(`broken static image reference: ${relative(file)}`);
}
if (new Set(cosmeticKeys).size !== cosmeticKeys.length) {
  failures.push("duplicate avatar cosmetic registry key");
}

const cosmeticKeySet = new Set(cosmeticKeys);
const inventoryAliases = new Map([
  ...fs.readFileSync(inventoryPath, "utf8").matchAll(/^\s*"([^"]+\.png)": "([^"]+)",?$/gm),
].map(([, alias, key]) => [alias, key]));
const cosmetics = JSON.parse(fs.readFileSync(cosmeticsPath, "utf8"));
for (const item of cosmetics) {
  if (!item.assetKey) failures.push(`catalog item ${item.itemId} has no assetKey`);
  else {
    const resolvedKey = inventoryAliases.get(item.assetKey) ?? item.assetKey;
    if (!cosmeticKeySet.has(resolvedKey)) {
      failures.push(`catalog item ${item.itemId} uses unknown assetKey ${item.assetKey}`);
    }
  }
}

for (const file of imageFiles) {
  const descriptor = describe(file);
  if (descriptor.registration === "Missing") {
    failures.push(`runtime asset is not statically registered: ${relative(file)}`);
  }
}

for (const mask of Array.from({ length: 16 }, (_, index) => String(index))) {
  if (!new RegExp(`^\\s*${mask}: require\\(`, "m").test(mapRegistry)) {
    failures.push(`path tile mask ${mask} is not registered`);
  }
}
for (const terrain of ["grass", "grass-grass", "grass-flowers", "grass-rocks", "grass-worn"]) {
  if (!mapRegistry.includes(`assets/base/tiles/${terrain}.png`)) {
    failures.push(`terrain tile ${terrain} is not registered`);
  }
}
for (const decoration of runtimePngs(path.join(assetsRoot, "base/decorations"))) {
  if (!mapRegistry.includes(`assets/base/decorations/${path.basename(decoration)}`)) {
    failures.push(`decoration ${path.basename(decoration)} is not registered`);
  }
}
for (const building of [
  "home-base", "workshop", "library", "training-grounds", "garden", "hall-of-achievement",
]) {
  for (let level = 1; level <= 5; level += 1) {
    const filename = `${building}/${building}-level-${level}.png`;
    if (!buildingRegistry.includes(`assets/base/buildings/${filename}`)) {
      failures.push(`building tier ${filename} is not registered`);
    }
  }
}

const rows = imageFiles.map((file) => {
  const metadata = readPngMetadata(file);
  return { file, metadata, descriptor: describe(file) };
});
const report = buildReport(rows);

if (process.argv.includes("--write")) {
  fs.writeFileSync(reportPath, report);
} else if (!fs.existsSync(reportPath) || fs.readFileSync(reportPath, "utf8") !== report) {
  failures.push("assets/ASSET_INVENTORY.md is stale; run npm run inventory:assets");
}

if (failures.length > 0) {
  for (const failure of failures) console.error(`FAIL ${failure}`);
  process.exitCode = 1;
} else {
  console.log(`All ${imageFiles.length} image assets are inventoried and all runtime assets resolve statically.`);
}

function describe(file) {
  const assetPath = path.relative(assetsRoot, file).split(path.sep).join("/");
  const parts = assetPath.split("/");
  const basename = path.basename(file, ".png");
  let type = "unknown/unclassified";
  let id = "—";
  let intentionalUnregistered = false;

  if (parts[0] === "avatar" && parts[1] === "v2") {
    const group = parts[2];
    const avatarTypes = {
      body: "base character/body assets",
      "body-girl": "base character/body assets",
      tops: "tunics",
      dresses: "dresses",
      bottoms: "pants",
      boots: "boots",
      hats: "hats/headwear",
      hair: "hairstyles",
      pets: "pets",
      auras: "auras",
      backgrounds: "backgrounds",
    };

    if (group === "aligned") {
      if (basename.endsWith("-hair")) {
        type = "hairstyles";
        id = `avatar-v2/hair/${basename.replace(/-hair$/, "")}`;
      } else if (basename === "azure-feather-cap") {
        type = "hats/headwear";
        id = "avatar-v2/hats/azure-feather-cap";
      } else if (basename.startsWith("guild-boots")) {
        type = "boots";
        id = "avatar-v2/boots/guild-boots";
      } else if (basename.startsWith("traveler-trousers")) {
        type = "pants";
        id = "avatar-v2/bottoms/traveler-trousers";
      } else {
        type = "tunics";
        id = basename === "guild-belt" ? "avatar-v2/tops/guild-tunic" : `avatar-v2/tops/${basename}`;
      }
      intentionalUnregistered = ["high-ponytail-hair", "long-shag-hair", "twin-braids-hair"].includes(basename);
    } else if (avatarTypes[group]) {
      type = avatarTypes[group];
      id = ["body", "body-girl"].includes(group)
        ? `body:${group === "body" ? "BOY" : "GIRL"}/${basename}`
        : `avatar-v2/${group}/${basename}`;
      intentionalUnregistered = group === "body" && basename === "head-neck";
    }
  } else if (parts[0] === "base") {
    if (parts[1] === "buildings") {
      type = "buildings";
      id = `building:${parts[2]}/level-${basename.match(/level-(\d+)$/)?.[1] ?? "?"}`;
    } else if (parts[1] === "archive") {
      type = "buildings";
      id = `archive:${parts.slice(2, -1).join("/")}/${basename}`;
      intentionalUnregistered = true;
    } else if (parts[1] === "backgrounds") {
      type = "backgrounds";
      id = `base:background/${basename}`;
    } else if (parts[1] === "tiles") {
      type = "world/map/tiles";
      id = parts[2] === "source"
        ? "—"
        : basename.startsWith("stone-mask-")
          ? `path-mask:${basename.slice(-2)}`
          : `terrain:${basename}`;
      intentionalUnregistered = parts[2] === "source";
    } else if (parts[1] === "decorations") {
      type = "decorative/environment assets";
      id = parts[2] === "source" ? "—" : `decoration:${basename}`;
      intentionalUnregistered = parts[2] === "source";
    }
  } else if (parts[0] === "images") {
    type = "UI/game graphics";
    id = `app:${basename}`;
    intentionalUnregistered = basename === "lifexp-icon-source";
  }

  const registered = referencedFiles.has(path.resolve(file));
  return {
    assetPath,
    type,
    id,
    registration: registered ? "Yes" : intentionalUnregistered ? "No (reference/source/archive)" : "Missing",
  };
}

function buildReport(rows) {
  const counts = new Map();
  for (const row of rows) {
    counts.set(row.descriptor.type, (counts.get(row.descriptor.type) ?? 0) + 1);
  }
  const countLines = [...counts.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([type, count]) => `| ${type} | ${count} |`)
    .join("\n");
  const tableLines = rows.map(({ file, metadata, descriptor }) => {
    const currentPath = `frontend/assets/${descriptor.assetPath}`;
    return `| ${currentPath} | ${path.basename(file)} | ${metadata.width}×${metadata.height} | PNG | ${metadata.transparent ? "Yes" : "No"} | ${descriptor.type} | ${descriptor.id} | ${descriptor.registration} | Yes | No | ${currentPath} |`;
  }).join("\n");

  return `# Evrenthia asset inventory

This deterministic inventory is generated by \`npm run inventory:assets\`. It records the repository state without changing image pixels or paths.

- Total image assets: **${rows.length}**
- Artwork moved: **0**
- Artwork renamed: **0**
- Exact-byte duplicate pairs retained intentionally: \`base/tiles/grass.png\` / \`base/tiles/grass-grass.png\`; \`images/android-icon-foreground.png\` / \`images/android-icon-monochrome.png\`.
- Source/reference-only art is kept beside its canonical asset family and is intentionally not loaded at runtime.

## Counts by inferred type

| Type | Count |
| --- | ---: |
${countLines}

## Per-asset inventory

| Current path | Filename | Dimensions | File type | Transparency | Inferred type | Inferred registry ID | Correctly registered | Stay | Move | Final canonical path |
| --- | --- | ---: | --- | --- | --- | --- | --- | --- | --- | --- |
${tableLines}
`;
}

function readPngMetadata(file) {
  const buffer = fs.readFileSync(file);
  if (buffer.subarray(0, 8).toString("hex") !== "89504e470d0a1a0a") {
    throw new Error(`${relative(file)} is not a PNG`);
  }

  let offset = 8;
  let width;
  let height;
  let bitDepth;
  let colorType;
  let hasTransparencyChunk = false;
  const imageData = [];
  while (offset < buffer.length) {
    const length = buffer.readUInt32BE(offset);
    const type = buffer.subarray(offset + 4, offset + 8).toString("ascii");
    const data = buffer.subarray(offset + 8, offset + 8 + length);
    offset += length + 12;
    if (type === "IHDR") {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      bitDepth = data[8];
      colorType = data[9];
    } else if (type === "IDAT") imageData.push(data);
    else if (type === "tRNS") hasTransparencyChunk = true;
    else if (type === "IEND") break;
  }
  if (bitDepth !== 8 || ![2, 6].includes(colorType)) {
    throw new Error(`${relative(file)} uses unsupported PNG color type ${colorType} / bit depth ${bitDepth}`);
  }
  return {
    width,
    height,
    transparent: hasTransparencyChunk || (colorType === 6 && rgbaHasTransparentPixel(imageData, width, height)),
  };
}

function rgbaHasTransparentPixel(chunks, width, height) {
  const bytesPerPixel = 4;
  const rowLength = width * bytesPerPixel;
  const inflated = zlib.inflateSync(Buffer.concat(chunks));
  const previous = Buffer.alloc(rowLength);
  const current = Buffer.alloc(rowLength);
  let offset = 0;

  for (let y = 0; y < height; y += 1) {
    const filter = inflated[offset];
    offset += 1;
    for (let x = 0; x < rowLength; x += 1) {
      const left = x >= bytesPerPixel ? current[x - bytesPerPixel] : 0;
      const above = previous[x];
      const upperLeft = x >= bytesPerPixel ? previous[x - bytesPerPixel] : 0;
      current[x] = unfilter(filter, inflated[offset + x], left, above, upperLeft);
    }
    for (let alpha = 3; alpha < rowLength; alpha += 4) {
      if (current[alpha] < 255) return true;
    }
    current.copy(previous);
    offset += rowLength;
  }
  return false;
}

function unfilter(filter, raw, left, above, upperLeft) {
  if (filter === 0) return raw;
  if (filter === 1) return (raw + left) & 0xff;
  if (filter === 2) return (raw + above) & 0xff;
  if (filter === 3) return (raw + Math.floor((left + above) / 2)) & 0xff;
  if (filter === 4) return (raw + paeth(left, above, upperLeft)) & 0xff;
  throw new Error(`unsupported PNG filter ${filter}`);
}

function paeth(left, above, upperLeft) {
  const prediction = left + above - upperLeft;
  const distances = [Math.abs(prediction - left), Math.abs(prediction - above), Math.abs(prediction - upperLeft)];
  if (distances[0] <= distances[1] && distances[0] <= distances[2]) return left;
  return distances[1] <= distances[2] ? above : upperLeft;
}

function collectStaticImageReferences(files) {
  const references = [];
  for (const file of files) {
    const source = fs.readFileSync(file, "utf8");
    for (const [, request] of source.matchAll(/require\(["']([^"']+\.png)["']\)/g)) {
      references.push(path.resolve(path.dirname(file), request));
    }
  }
  return references;
}

function collectAppImageReferences(appJsonPath) {
  const references = [];
  visit(JSON.parse(fs.readFileSync(appJsonPath, "utf8")));
  return references;

  function visit(value) {
    if (typeof value === "string" && value.endsWith(".png")) {
      references.push(path.resolve(path.dirname(appJsonPath), value));
    } else if (Array.isArray(value)) {
      value.forEach(visit);
    } else if (value && typeof value === "object") {
      Object.values(value).forEach(visit);
    }
  }
}

function objectKeysBetween(source, start, end) {
  const block = source.slice(source.indexOf(start), source.indexOf(end));
  return [...block.matchAll(/^\s{2}"([^"]+)":/gm)].map((match) => match[1]);
}

function runtimePngs(directory) {
  return fs.readdirSync(directory, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith(".png"))
    .map((entry) => path.join(directory, entry.name));
}

function findCodeFiles(directory) {
  return findFiles(directory).filter((file) => /\.(?:js|mjs|ts|tsx)$/.test(file));
}

function findFiles(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const file = path.join(directory, entry.name);
    return entry.isDirectory() ? findFiles(file) : entry.isFile() ? [file] : [];
  });
}

function relative(file) {
  return path.relative(repositoryRoot, file).split(path.sep).join("/");
}
