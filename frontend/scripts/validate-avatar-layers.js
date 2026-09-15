/* global __dirname, Buffer */
const fs = require("node:fs");
const path = require("node:path");
const zlib = require("node:zlib");

const CANVAS_WIDTH = 1254;
const CANVAS_HEIGHT = 1254;
const avatarRoot = path.resolve(__dirname, "../assets/avatar/v2");
const registryPath = path.resolve(__dirname, "../src/avatar/assetRegistry.ts");
const framedClothingSources = [...fs.readFileSync(registryPath, "utf8")
  .matchAll(/(?:trousersAsset|bootsAsset|hatAsset|framedHair)\(\s*require\("([^"]+)"\)/g)]
  .map(([, source]) => path.resolve(path.dirname(registryPath), source));

const sharedCanvasSprites = [
  ...["body", "aligned"].flatMap((directory) => findPngFiles(path.join(avatarRoot, directory))),
  ...framedClothingSources,
]
  .map((absolutePath) => path.relative(avatarRoot, absolutePath))
  .sort();

const sourceSizes = new Map(sharedCanvasSprites.map((file) => [file, [CANVAS_WIDTH, CANVAS_HEIGHT]]));
sourceSizes.set("body-girl/head.png", [1254, 1254]);
sourceSizes.set("body-girl/torso.png", [1086, 1448]);
for (const limb of ["left-arm", "right-arm", "left-leg", "right-leg"]) {
  sourceSizes.set(`body-girl/${limb}.png`, [1024, 1536]);
}
for (const [, source] of fs.readFileSync(registryPath, "utf8")
  .matchAll(/dressAsset\(\s*require\("([^"]+)"\)/g)) {
  sourceSizes.set(path.relative(avatarRoot, path.resolve(path.dirname(registryPath), source)), [1086, 1448]);
}

let hasErrors = false;

for (const [relativePath, [expectedWidth, expectedHeight]] of sourceSizes) {
  const absolutePath = path.join(avatarRoot, relativePath);

  try {
    const png = readRgbaPng(absolutePath);
    const problems = [];

    if (png.width !== expectedWidth || png.height !== expectedHeight) {
      problems.push(
        `expected ${expectedWidth}x${expectedHeight}, received ${png.width}x${png.height}`,
      );
    }
    if (!png.hasTransparentPixel) {
      problems.push("has no transparent pixels");
    }

    if (problems.length > 0) {
      hasErrors = true;
      console.error(`FAIL ${relativePath}: ${problems.join("; ")}`);
    } else {
      console.log(`PASS ${relativePath}`);
    }
  } catch (error) {
    hasErrors = true;
    console.error(`FAIL ${relativePath}: ${error.message}`);
  }
}

if (hasErrors) {
  process.exitCode = 1;
} else {
  console.log(
    `All ${sourceSizes.size} character sprites match their registered transparent source canvases.`,
  );
}

function readRgbaPng(filePath) {
  const buffer = fs.readFileSync(filePath);
  const signature = buffer.subarray(0, 8).toString("hex");
  if (signature !== "89504e470d0a1a0a") {
    throw new Error("not a PNG file");
  }

  let offset = 8;
  let width;
  let height;
  let bitDepth;
  let colorType;
  const imageDataChunks = [];

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
    } else if (type === "IDAT") {
      imageDataChunks.push(data);
    } else if (type === "IEND") {
      break;
    }
  }

  if (bitDepth !== 8 || colorType !== 6) {
    throw new Error(
      `expected an 8-bit RGBA PNG, received bit depth ${bitDepth}, color type ${colorType}`,
    );
  }

  const bytesPerPixel = 4;
  const rowLength = width * bytesPerPixel;
  const inflated = zlib.inflateSync(Buffer.concat(imageDataChunks));
  const previousRow = Buffer.alloc(rowLength);
  const currentRow = Buffer.alloc(rowLength);
  let sourceOffset = 0;
  let hasTransparentPixel = false;

  for (let y = 0; y < height; y += 1) {
    const filterType = inflated[sourceOffset];
    sourceOffset += 1;

    for (let x = 0; x < rowLength; x += 1) {
      const raw = inflated[sourceOffset + x];
      const left = x >= bytesPerPixel ? currentRow[x - bytesPerPixel] : 0;
      const above = previousRow[x];
      const upperLeft = x >= bytesPerPixel ? previousRow[x - bytesPerPixel] : 0;

      currentRow[x] = unfilterByte(
        filterType,
        raw,
        left,
        above,
        upperLeft,
      );
    }

    for (let alphaIndex = 3; alphaIndex < rowLength; alphaIndex += 4) {
      if (currentRow[alphaIndex] < 255) {
        hasTransparentPixel = true;
        break;
      }
    }

    currentRow.copy(previousRow);
    sourceOffset += rowLength;
  }

  return { width, height, hasTransparentPixel };
}

function unfilterByte(filterType, raw, left, above, upperLeft) {
  switch (filterType) {
    case 0:
      return raw;
    case 1:
      return (raw + left) & 0xff;
    case 2:
      return (raw + above) & 0xff;
    case 3:
      return (raw + Math.floor((left + above) / 2)) & 0xff;
    case 4:
      return (raw + paethPredictor(left, above, upperLeft)) & 0xff;
    default:
      throw new Error(`unsupported PNG filter ${filterType}`);
  }
}

function paethPredictor(left, above, upperLeft) {
  const prediction = left + above - upperLeft;
  const leftDistance = Math.abs(prediction - left);
  const aboveDistance = Math.abs(prediction - above);
  const upperLeftDistance = Math.abs(prediction - upperLeft);

  if (leftDistance <= aboveDistance && leftDistance <= upperLeftDistance) {
    return left;
  }
  return aboveDistance <= upperLeftDistance ? above : upperLeft;
}

function findPngFiles(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const absolutePath = path.join(directory, entry.name);
    if (entry.isDirectory()) return findPngFiles(absolutePath);
    return entry.isFile() && entry.name.toLowerCase().endsWith(".png")
      ? [absolutePath]
      : [];
  });
}
