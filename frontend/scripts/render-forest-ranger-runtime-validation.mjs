import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { PNG } from "pngjs";

import { avatarTintMatrix } from "../src/avatar/colorize.ts";
import { spriteImageRect } from "../src/avatar/spriteLayout.ts";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const frontendRoot = path.resolve(scriptDirectory, "..");
const assetRoot = path.join(frontendRoot, "assets/avatar/v2");
const dressName = process.env.DRESS_VALIDATION_NAME ?? "forest-ranger";
const outputRoot = process.env.DRESS_VALIDATION_OUTPUT
  ?? path.join(frontendRoot, "artwork-candidates/avatar/v2/base-validation");
const productionPath = process.env.DRESS_VALIDATION_SOURCE
  ?? path.join(assetRoot, `dresses/${dressName}.png`);
const registryPath = path.join(frontendRoot, "src/avatar/assetRegistry.ts");
const rendererPath = path.join(frontendRoot, "src/components/CharacterSpriteLayers.tsx");
const girlSilhouettePath = path.join(assetRoot, "body-girl/silhouettes.json");
const EXPECTED_PRODUCTION_SHA = process.env.DRESS_VALIDATION_SOURCE || process.env.DRESS_VALIDATION_NAME
  ? crypto.createHash("sha256").update(fs.readFileSync(productionPath)).digest("hex")
  : "1bf33c778fe42077b951e727313e54c7d12a18fcbbe5ad5698e74f646aeebb92";
const CANVAS = 1254;
const filterColorSpace = process.env.AVATAR_VALIDATION_COLOR_SPACE ?? "linearRGB";

const registrySource = fs.readFileSync(registryPath, "utf8");
const dressEntry = registrySource.match(new RegExp(
  `"avatar-v2/dresses/${dressName}": dressAsset\\(\\s*require\\("[^\"]+/${dressName}\\.png"\\), \\[([^\\]]+)\\], (\\d+), (\\d+)\\)`,
));
assert.ok(dressEntry, `Missing registry entry for ${dressName}`);
const [left, top, right, bottom] = dressEntry[1].split(",").map(Number);
const destination = registrySource.match(/sourceFrame\(\[1086, 1448\], \[0, from, 1086, to\], \[([\d.]+), y, ([\d.]+), height\]\)/);
assert.ok(destination, "Missing shared dress destination rectangle");
const runtimeContract = {
  sourceSize: [1086, 1448],
  bounds: [left, top, right, bottom],
  shoulderY: Number(dressEntry[2]),
  waistY: Number(dressEntry[3]),
  destinationX: Number(destination[1]),
  destinationWidth: Number(destination[2]),
  collar: { destinationY: 250, destinationHeight: 45 },
  bodice: { destinationY: 295, destinationHeight: 275 },
  skirt: { destinationY: 570, destinationHeight: 610 },
};

const girlFrames = {
  leftArm: sourceFrame([1024, 1536], [342, 73, 799, 1502], [706.48, 289.975, 155.38, 464.425]),
  rightArm: sourceFrame([1024, 1536], [283, 73, 682, 1474], [411.82, 289.975, 135.66, 455.325]),
  leftLeg: sourceFrame([1024, 1536], [397, 82, 739, 1435], [597.8, 584.15, 205.2, 623.5]),
  rightLeg: sourceFrame([1024, 1536], [381, 47, 642, 1397], [465, 584.15, 156.6, 623.5]),
  torso: sourceFrame([1086, 1448], [219, 188, 868, 1294], [490.92, 244.36, 272.58, 453.46]),
  neck: sourceFrame([1254, 1254], [200, 992, 1050, 1159], [520.75, 265.16, 212.5, 55.67]),
  head: sourceFrame([1254, 1254], [200, 615, 1050, 995], [520.75, 160, 212.5, 106]),
  crown: sourceFrame([1254, 1254], [200, 99, 1050, 615.5], [520.75, 38.055, 212.5, 122.085]),
};

const sha256 = (buffer) => crypto.createHash("sha256").update(buffer).digest("hex");

function sourceFrame(size, bounds, destination) {
  const [x, y, right, bottom] = bounds;
  const [dx, dy, width, height] = destination;
  return {
    crop: { x, y, width: right - x, height: bottom - y, sourceWidth: size[0], sourceHeight: size[1] },
    destination: { x: dx, y: dy, width, height },
  };
}

function linePolygons(pathData) {
  const tokens = pathData.match(/[MLZ]|-?\d+(?:\.\d+)?/g) ?? [];
  const polygons = [];
  let polygon;
  for (let index = 0; index < tokens.length;) {
    const command = tokens[index++];
    if (command === "M") {
      if (polygon?.length) polygons.push(polygon);
      polygon = [[Number(tokens[index++]), Number(tokens[index++])]];
    } else if (command === "L") {
      assert.ok(polygon, "Line command before move command");
      polygon.push([Number(tokens[index++]), Number(tokens[index++])]);
    } else if (command === "Z") {
      if (polygon?.length) polygons.push(polygon);
      polygon = undefined;
    } else {
      throw new Error(`Unsupported silhouette token: ${command}`);
    }
  }
  if (polygon?.length) polygons.push(polygon);
  return polygons;
}

const girlSilhouettes = JSON.parse(fs.readFileSync(girlSilhouettePath, "utf8"));
girlFrames.leftArm.sourcePolygons = linePolygons(girlSilhouettes["left-arm"]);
girlFrames.rightArm.sourcePolygons = linePolygons(girlSilhouettes["right-arm"]);

function assertRuntimeContract() {
  const registry = registrySource;
  const renderer = fs.readFileSync(rendererPath, "utf8");
  assert.ok(dressEntry, `Missing ${dressName} asset registration`);
  assert.doesNotMatch(registry, /armholeOcclusion|dressClipPath|coversShoulderCaps/);
  assert.match(registry, /id, layer: "upperBody", source, fullOutfit: true/);
  assert.match(registry, /\{ id: "collar", from: top - 4, to: shoulderY, y: 250, height: 45 \}/);
  assert.match(registry, /\{ id: "bodice", from: shoulderY, to: waistY, y: 295, height: 275 \}/);
  assert.match(registry, /\{ id: "skirt", from: waistY, to: bottom \+ 4, y: 570, height: 610 \}/);
  assert.equal(runtimeContract.destinationX + runtimeContract.destinationWidth / 2, 627);
  assert.match(renderer, /viewBox="0 -64 1254 1318"/);
  assert.match(renderer, /<Image href=\{source\} \{\.\.\.spriteImageRect\(frame\)\} preserveAspectRatio="none"/);
}

function dressFrames() {
  const { sourceSize, bounds, shoulderY, waistY, destinationX, destinationWidth } = runtimeContract;
  const [, top, , bottom] = bounds;
  return {
    collar: sourceFrame(sourceSize, [0, top - 4, 1086, shoulderY], [destinationX, 250, destinationWidth, 45]),
    bodice: sourceFrame(sourceSize, [0, shoulderY, 1086, waistY], [destinationX, 295, destinationWidth, 275]),
    skirt: sourceFrame(sourceSize, [0, waistY, 1086, bottom + 4], [destinationX, 570, destinationWidth, 610]),
  };
}

function blank(width = CANVAS, height = CANVAS, color = [0, 0, 0, 0]) {
  const image = new PNG({ width, height });
  for (let offset = 0; offset < image.data.length; offset += 4) {
    image.data[offset] = color[0];
    image.data[offset + 1] = color[1];
    image.data[offset + 2] = color[2];
    image.data[offset + 3] = color[3];
  }
  return image;
}

function clone(image) {
  const result = blank(image.width, image.height);
  image.data.copy(result.data);
  return result;
}

const imageCache = new Map();
function load(relativePath) {
  const absolutePath = path.join(assetRoot, relativePath);
  if (!imageCache.has(absolutePath)) imageCache.set(absolutePath, PNG.sync.read(fs.readFileSync(absolutePath)));
  return imageCache.get(absolutePath);
}

const toLinear = (value) => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
const toSrgb = (value) => value <= 0.0031308 ? value * 12.92 : 1.055 * value ** (1 / 2.4) - 0.055;

function tint(image, channel, color) {
  const matrix = avatarTintMatrix(channel, color, filterColorSpace);
  const result = clone(image);
  for (let offset = 0; offset < result.data.length; offset += 4) {
    const input = [result.data[offset] / 255, result.data[offset + 1] / 255, result.data[offset + 2] / 255, result.data[offset + 3] / 255, 1];
    if (filterColorSpace === "linearRGB") for (let index = 0; index < 3; index += 1) input[index] = toLinear(input[index]);
    for (let row = 0; row < 4; row += 1) {
      let value = 0;
      for (let column = 0; column < 5; column += 1) value += matrix[row * 5 + column] * input[column];
      if (filterColorSpace === "linearRGB" && row < 3) value = toSrgb(value);
      result.data[offset + row] = Math.max(0, Math.min(255, Math.round(value * 255)));
    }
  }
  return result;
}

function grayscale(image) {
  const result = clone(image);
  for (let offset = 0; offset < result.data.length; offset += 4) {
    const rgb = [0, 1, 2].map((channel) => result.data[offset + channel] / 255);
    if (filterColorSpace === "linearRGB") for (let channel = 0; channel < 3; channel += 1) rgb[channel] = toLinear(rgb[channel]);
    const gray = rgb[0] * 0.2126 + rgb[1] * 0.7152 + rgb[2] * 0.0722;
    const value = Math.round(255 * (filterColorSpace === "linearRGB" ? toSrgb(gray) : gray));
    result.data[offset] = value;
    result.data[offset + 1] = value;
    result.data[offset + 2] = value;
  }
  return result;
}

function samplePremultiplied(image, x, y) {
  const x0 = Math.max(0, Math.min(image.width - 1, Math.floor(x)));
  const y0 = Math.max(0, Math.min(image.height - 1, Math.floor(y)));
  const x1 = Math.max(0, Math.min(image.width - 1, x0 + 1));
  const y1 = Math.max(0, Math.min(image.height - 1, y0 + 1));
  const fx = x - Math.floor(x);
  const fy = y - Math.floor(y);
  const samples = [
    [x0, y0, (1 - fx) * (1 - fy)], [x1, y0, fx * (1 - fy)],
    [x0, y1, (1 - fx) * fy], [x1, y1, fx * fy],
  ];
  let alpha = 0;
  const rgb = [0, 0, 0];
  for (const [sx, sy, weight] of samples) {
    const offset = (sy * image.width + sx) * 4;
    const sourceAlpha = image.data[offset + 3] / 255;
    alpha += sourceAlpha * weight;
    for (let channel = 0; channel < 3; channel += 1) rgb[channel] += image.data[offset + channel] * sourceAlpha * weight;
  }
  if (alpha > 0) for (let channel = 0; channel < 3; channel += 1) rgb[channel] /= alpha;
  return [rgb[0], rgb[1], rgb[2], alpha * 255];
}

function compositePixel(canvas, x, y, sourcePixel) {
  if (x < 0 || y < 0 || x >= canvas.width || y >= canvas.height) return;
  const offset = (y * canvas.width + x) * 4;
  const sourceAlpha = sourcePixel[3] / 255;
  if (sourceAlpha <= 0) return;
  const destinationAlpha = canvas.data[offset + 3] / 255;
  const outputAlpha = sourceAlpha + destinationAlpha * (1 - sourceAlpha);
  for (let channel = 0; channel < 3; channel += 1) {
    canvas.data[offset + channel] = Math.round(
      (sourcePixel[channel] * sourceAlpha + canvas.data[offset + channel] * destinationAlpha * (1 - sourceAlpha)) / outputAlpha,
    );
  }
  canvas.data[offset + 3] = Math.round(outputAlpha * 255);
}

function inClip(x, y, clip) {
  return !clip || (x >= clip.x && x < clip.x + clip.width && y >= clip.y && y < clip.y + clip.height);
}

/** Raster equivalent of CharacterSpriteLayers' clipped SVG Image element. */
function renderFrame(canvas, image, frame, clip, occlusions) {
  const imageRect = spriteImageRect(frame);
  const viewport = frame?.destination ?? { x: 0, y: 0, width: CANVAS, height: CANVAS };
  const left = Math.max(0, Math.floor(viewport.x));
  const top = Math.max(0, Math.floor(viewport.y));
  const right = Math.min(canvas.width, Math.ceil(viewport.x + viewport.width));
  const bottom = Math.min(canvas.height, Math.ceil(viewport.y + viewport.height));
  for (let y = top; y < bottom; y += 1) {
    for (let x = left; x < right; x += 1) {
      if (!inClip(x + 0.5, y + 0.5, clip)) continue;
      if (occlusions?.some((polygon) => pointInPolygon(polygon, x + 0.5, y + 0.5))) continue;
      const sourceX = ((x + 0.5 - imageRect.x) / imageRect.width) * image.width - 0.5;
      const sourceY = ((y + 0.5 - imageRect.y) / imageRect.height) * image.height - 0.5;
      if (frame?.sourcePolygons && !frame.sourcePolygons.reduce(
        (inside, polygon) => inside !== pointInPolygon(polygon, sourceX, sourceY), false,
      )) continue;
      compositePixel(canvas, x, y, samplePremultiplied(image, sourceX, sourceY));
    }
  }
}

function renderPair(canvas, bodyType, part, frame, clip, skinColor) {
  const root = `appearance/skin/${bodyType.toLowerCase()}`;
  renderFrame(canvas, tint(load(`${root}/${part}-neutral.png`), "skin", skinColor), frame, clip);
  renderFrame(canvas, grayscale(load(`${root}/${part}-details.png`)), frame, clip);
}

function renderSkinLayer(canvas, bodyType, part, kind, frame, clip, skinColor) {
  const root = `appearance/skin/${bodyType.toLowerCase()}`;
  const image = load(`${root}/${part}-${kind}.png`);
  renderFrame(canvas, kind === "neutral" ? tint(image, "skin", skinColor) : grayscale(image), frame, clip);
}

function renderDress(image) {
  const result = blank();
  const frames = dressFrames();
  // Same priority and key ordering as AvatarRenderer: bodice, collar, skirt.
  for (const key of ["bodice", "collar", "skirt"]) renderFrame(result, image, frames[key]);
  return result;
}

function renderAvatar(bodyType, outfit, skinColor = "#D79773") {
  const canvas = blank();
  const dressEquipped = outfit === "dress";
  const legsCovered = outfit === "starter";
  const centerSkin = dressEquipped ? { x: 584, y: 0, width: 86, height: 390 } : undefined;
  const legs = dressEquipped ? { x: 0, y: 900, width: CANVAS, height: 354 } : undefined;

  if (bodyType === "BOY") {
    renderPair(canvas, bodyType, "left-arm", undefined, undefined, skinColor);
    if (!legsCovered) renderPair(canvas, bodyType, "left-leg", undefined, legs, skinColor);
    renderPair(canvas, bodyType, "right-arm", undefined, undefined, skinColor);
    if (!legsCovered) renderPair(canvas, bodyType, "right-leg", undefined, legs, skinColor);
    renderPair(canvas, bodyType, "neck", undefined, centerSkin, skinColor);
    renderPair(canvas, bodyType, "torso", undefined, centerSkin, skinColor);
  } else {
    renderPair(canvas, bodyType, "left-arm", girlFrames.leftArm, undefined, skinColor);
    if (!legsCovered) renderPair(canvas, bodyType, "left-leg", girlFrames.leftLeg, legs, skinColor);
    renderPair(canvas, bodyType, "head", girlFrames.neck, centerSkin, skinColor);
    renderPair(canvas, bodyType, "right-arm", girlFrames.rightArm, undefined, skinColor);
    if (!legsCovered) renderPair(canvas, bodyType, "right-leg", girlFrames.rightLeg, legs, skinColor);
    renderPair(canvas, bodyType, "torso", girlFrames.torso, centerSkin, skinColor);
  }

  if (outfit === "starter") {
    renderFrame(canvas, load("aligned/traveler-trousers-right-leg.png"));
    renderFrame(canvas, load("aligned/traveler-trousers-left-leg.png"));
    renderFrame(canvas, load("aligned/traveler-trousers-waist.png"));
    renderFrame(canvas, load("aligned/guild-boots-right.png"));
    renderFrame(canvas, load("aligned/guild-boots-left.png"));
    renderFrame(canvas, load("aligned/guild-tunic.png"));
    renderFrame(canvas, load("aligned/guild-belt.png"));
  } else if (dressEquipped) {
    renderFrame(canvas, renderDress(production));
  }

  if (bodyType === "BOY") {
    renderSkinLayer(canvas, bodyType, "head", "neutral", undefined, undefined, skinColor);
    renderFrame(canvas, tint(load("appearance/eyes/boy/iris-mask.png"), "eyes", "#76503A"));
    renderFrame(canvas, load("appearance/eyes/boy/eye-details.png"));
    renderSkinLayer(canvas, bodyType, "head", "details", undefined, undefined, skinColor);
  } else {
    renderSkinLayer(canvas, bodyType, "head", "neutral", girlFrames.crown, undefined, skinColor);
    renderSkinLayer(canvas, bodyType, "head", "neutral", girlFrames.head, undefined, skinColor);
    renderSkinLayer(canvas, bodyType, "head", "details", girlFrames.crown, undefined, skinColor);
    renderFrame(canvas, tint(load("appearance/eyes/girl/iris-mask.png"), "eyes", "#76503A"), girlFrames.head);
    renderFrame(canvas, load("appearance/eyes/girl/eye-details.png"), girlFrames.head);
    renderSkinLayer(canvas, bodyType, "head", "details", girlFrames.head, undefined, skinColor);
  }
  return canvas;
}

function pointInPolygon(polygon, x, y) {
  let inside = false;
  for (let current = 0, previous = polygon.length - 1; current < polygon.length; previous = current++) {
    const [cx, cy] = polygon[current];
    const [px, py] = polygon[previous];
    if (((cy > y) !== (py > y)) && x < ((px - cx) * (y - cy)) / (py - cy) + cx) inside = !inside;
  }
  return inside;
}

function boundingBox(points) {
  return [
    Math.min(...points.map(([x]) => x)), Math.min(...points.map(([, y]) => y)),
    Math.max(...points.map(([x]) => x)), Math.max(...points.map(([, y]) => y)),
  ];
}

function difference(before, after) {
  const changed = [];
  for (let y = 0; y < before.height; y += 1) {
    for (let x = 0; x < before.width; x += 1) {
      const offset = (y * before.width + x) * 4;
      if (before.data.subarray(offset, offset + 4).equals(after.data.subarray(offset, offset + 4))) continue;
      changed.push([x, y]);
    }
  }
  return { pixels: changed.length, bounds: boundingBox(changed) };
}

function cropAndScale(image, crop, scale) {
  const [cropX, cropY, width, height] = crop;
  const output = blank(width * scale, height * scale, [16, 23, 19, 255]);
  for (let y = 0; y < output.height; y += 1) {
    for (let x = 0; x < output.width; x += 1) {
      compositePixel(output, x, y, samplePremultiplied(image, cropX + (x + 0.5) / scale - 0.5, cropY + (y + 0.5) / scale - 0.5));
    }
  }
  return output;
}

function appViewport(image, size = 960) {
  const output = blank(size, size, [16, 23, 19, 255]);
  const viewBox = { x: 0, y: -64, width: 1254, height: 1318 };
  const scale = Math.min(size / viewBox.width, size / viewBox.height);
  const renderedWidth = viewBox.width * scale;
  const renderedHeight = viewBox.height * scale;
  const offsetX = (size - renderedWidth) / 2;
  const offsetY = (size - renderedHeight) / 2;
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const sourceX = viewBox.x + (x + 0.5 - offsetX) / scale - 0.5;
      const sourceY = viewBox.y + (y + 0.5 - offsetY) / scale - 0.5;
      if (sourceX < 0 || sourceY < 0 || sourceX >= image.width || sourceY >= image.height) continue;
      compositePixel(output, x, y, samplePremultiplied(image, sourceX, sourceY));
    }
  }
  return output;
}

function write(name, image) {
  fs.writeFileSync(path.join(outputRoot, name), PNG.sync.write(image));
}

assertRuntimeContract();
fs.mkdirSync(outputRoot, { recursive: true });
const productionBuffer = fs.readFileSync(productionPath);
assert.equal(sha256(productionBuffer), EXPECTED_PRODUCTION_SHA, "Original Forest Ranger source changed");
const production = PNG.sync.read(productionBuffer);
assert.deepEqual([production.width, production.height], [1086, 1448]);
assert.equal(production.colorType, 6, "Forest Ranger source must remain RGBA");

for (const bodyType of ["BOY", "GIRL"]) {
  for (const outfit of process.env.DRESS_VALIDATION_FAST ? ["dress"] : ["base", "starter", "dress"]) {
    const avatar = renderAvatar(bodyType, outfit);
    const name = `${bodyType.toLowerCase()}-${outfit}`;
    write(`${name}-app.png`, appViewport(avatar, 320));
    write(`${name}-app-3x.png`, appViewport(avatar));
    write(`${name}-upper-body-4x.png`, cropAndScale(avatar, [360, 110, 534, 680], 2));
  }
  for (const [tone, skinColor] of Object.entries(process.env.DRESS_VALIDATION_FAST
    ? {} : { light: "#E9B396", mid: "#B16D49", dark: "#41231E" })) {
    const avatar = renderAvatar(bodyType, "base", skinColor);
    write(`${bodyType.toLowerCase()}-base-${tone}-upper-body-4x.png`, cropAndScale(avatar, [360, 110, 534, 680], 2));
  }
}

const productionShaAfter = sha256(fs.readFileSync(productionPath));
assert.equal(productionShaAfter, EXPECTED_PRODUCTION_SHA, "Forest Ranger production PNG was modified");
const report = {
  filterColorSpace,
  productionSha256: EXPECTED_PRODUCTION_SHA,
  productionSha256After: productionShaAfter,
  dimensions: [production.width, production.height],
  colorType: "RGBA",
  scenarios: ["base", "starter", "dress"],
  bodyTypes: ["BOY", "GIRL"],
  sourcePngModified: false,
};
fs.writeFileSync(path.join(outputRoot, "avatar-base-validation.json"), `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify(report, null, 2));
