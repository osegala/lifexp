/* global Buffer */
const fs = require("node:fs");
const path = require("node:path");
const { PNG } = require("pngjs");

const repositoryRoot = path.resolve(__dirname, "../..");
const assetRoot = path.join(repositoryRoot, "frontend/assets/avatar/v2");
const candidateRoot = path.join(repositoryRoot, "frontend/artwork-candidates/avatar/v2/dresses");
const comparisonRoot = path.join(candidateRoot, "comparisons");
const CANVAS = 1254;

const dressFrames = {
  starlight: [[96, 114, 990, 1291], 218, 614],
  frostbound: [[49, 101, 1039, 1348], 219, 605],
  "teal-wayfarer": [[76, 83, 1010, 1302], 193, 562],
  "crimson-guard": [[42, 68, 1044, 1385], 177, 617],
  "royal-vanguard": [[70, 80, 1016, 1312], 203, 601],
  "royal-bard": [[46, 100, 1042, 1292], 207, 612],
  "harbor-scout": [[39, 96, 1048, 1328], 205, 597],
  "verdant-warden": [[65, 111, 1022, 1340], 220, 589],
  "celestial-acolyte": [[81, 93, 1005, 1321], 202, 560],
};

const girlFrames = {
  leftArm: [[342, 73, 799, 1502], [706.48, 289.975, 155.38, 464.425]],
  rightArm: [[283, 73, 682, 1474], [411.82, 289.975, 135.66, 455.325]],
  leftLeg: [[397, 82, 739, 1435], [597.8, 584.15, 205.2, 623.5]],
  rightLeg: [[381, 47, 642, 1397], [465, 584.15, 156.6, 623.5]],
  torso: [[219, 188, 868, 1294], [490.92, 244.36, 272.58, 453.46]],
  neck: [[200, 992, 1050, 1159], [520.75, 265.16, 212.5, 55.67]],
  head: [[200, 615, 1050, 995], [520.75, 160, 212.5, 106]],
  crown: [[200, 99, 1050, 615.5], [520.75, 38.055, 212.5, 122.085]],
};

const font = {
  " ": ["00000", "00000", "00000", "00000", "00000", "00000", "00000"],
  A: ["01110", "10001", "10001", "11111", "10001", "10001", "10001"],
  B: ["11110", "10001", "10001", "11110", "10001", "10001", "11110"],
  C: ["01111", "10000", "10000", "10000", "10000", "10000", "01111"],
  D: ["11110", "10001", "10001", "10001", "10001", "10001", "11110"],
  E: ["11111", "10000", "10000", "11110", "10000", "10000", "11111"],
  G: ["01111", "10000", "10000", "10111", "10001", "10001", "01111"],
  I: ["11111", "00100", "00100", "00100", "00100", "00100", "11111"],
  L: ["10000", "10000", "10000", "10000", "10000", "10000", "11111"],
  N: ["10001", "11001", "10101", "10011", "10001", "10001", "10001"],
  O: ["01110", "10001", "10001", "10001", "10001", "10001", "01110"],
  R: ["11110", "10001", "10001", "11110", "10100", "10010", "10001"],
  F: ["11111", "10000", "10000", "11110", "10000", "10000", "10000"],
  H: ["10001", "10001", "10001", "11111", "10001", "10001", "10001"],
  M: ["10001", "11011", "10101", "10101", "10001", "10001", "10001"],
  S: ["01111", "10000", "10000", "01110", "00001", "00001", "11110"],
  T: ["11111", "00100", "00100", "00100", "00100", "00100", "00100"],
  U: ["10001", "10001", "10001", "10001", "10001", "10001", "01110"],
  V: ["10001", "10001", "10001", "10001", "10001", "01010", "00100"],
  W: ["10001", "10001", "10001", "10101", "10101", "11011", "10001"],
  Y: ["10001", "10001", "01010", "00100", "00100", "00100", "00100"],
};

const imageCache = new Map();
function load(relativePath) {
  const absolutePath = path.join(assetRoot, relativePath);
  if (!imageCache.has(absolutePath)) imageCache.set(absolutePath, PNG.sync.read(fs.readFileSync(absolutePath)));
  return imageCache.get(absolutePath);
}

function newCanvas(width = CANVAS, height = CANVAS, color = [0, 0, 0, 0]) {
  const canvas = new PNG({ width, height });
  for (let offset = 0; offset < canvas.data.length; offset += 4) {
    canvas.data[offset] = color[0];
    canvas.data[offset + 1] = color[1];
    canvas.data[offset + 2] = color[2];
    canvas.data[offset + 3] = color[3];
  }
  return canvas;
}

function clone(image) {
  const copy = newCanvas(image.width, image.height);
  image.data.copy(copy.data);
  return copy;
}

function skinTint(image, hexColor = "#D79773") {
  const hex = hexColor.slice(1);
  const midtone = [0, 2, 4].map((offset) => Number.parseInt(hex.slice(offset, offset + 2), 16) / 255);
  const shadow = [midtone[0] * 0.86, midtone[1] * 0.65, midtone[2] * 0.55];
  const middle = (0.78 - 0.6) / (0.9 - 0.6);
  const highlight = midtone.map((value, index) => (value - (1 - middle) * shadow[index]) / middle);
  const output = clone(image);
  for (let offset = 0; offset < output.data.length; offset += 4) {
    const alpha = output.data[offset + 3] / 255;
    if (alpha === 0) continue;
    const luminance = (0.2126 * output.data[offset] + 0.7152 * output.data[offset + 1] + 0.0722 * output.data[offset + 2]) / 255;
    for (let channel = 0; channel < 3; channel += 1) {
      const slope = (highlight[channel] - shadow[channel]) / 0.3;
      const value = slope * luminance + (shadow[channel] - slope * 0.6) * alpha;
      output.data[offset + channel] = Math.max(0, Math.min(255, Math.round(value * 255)));
    }
  }
  return output;
}

function multiplyTint(image, hexColor) {
  const hex = hexColor.slice(1);
  const scales = [0, 2, 4].map((offset) => Number.parseInt(hex.slice(offset, offset + 2), 16) / 255);
  const output = clone(image);
  for (let offset = 0; offset < output.data.length; offset += 4) {
    for (let channel = 0; channel < 3; channel += 1) output.data[offset + channel] *= scales[channel];
  }
  return output;
}

function sample(image, x, y) {
  const x0 = Math.max(0, Math.min(image.width - 1, Math.floor(x)));
  const y0 = Math.max(0, Math.min(image.height - 1, Math.floor(y)));
  const x1 = Math.max(0, Math.min(image.width - 1, x0 + 1));
  const y1 = Math.max(0, Math.min(image.height - 1, y0 + 1));
  const fx = x - Math.floor(x);
  const fy = y - Math.floor(y);
  const result = [0, 0, 0, 0];
  for (let channel = 0; channel < 4; channel += 1) {
    const top = image.data[(y0 * image.width + x0) * 4 + channel] * (1 - fx)
      + image.data[(y0 * image.width + x1) * 4 + channel] * fx;
    const bottom = image.data[(y1 * image.width + x0) * 4 + channel] * (1 - fx)
      + image.data[(y1 * image.width + x1) * 4 + channel] * fx;
    result[channel] = top * (1 - fy) + bottom * fy;
  }
  return result;
}

function compositePixel(canvas, x, y, sourcePixel) {
  if (x < 0 || y < 0 || x >= canvas.width || y >= canvas.height) return;
  const offset = (y * canvas.width + x) * 4;
  const sourceAlpha = sourcePixel[3] / 255;
  if (sourceAlpha === 0) return;
  const destinationAlpha = canvas.data[offset + 3] / 255;
  const outputAlpha = sourceAlpha + destinationAlpha * (1 - sourceAlpha);
  for (let channel = 0; channel < 3; channel += 1) {
    canvas.data[offset + channel] = Math.round(
      (sourcePixel[channel] * sourceAlpha + canvas.data[offset + channel] * destinationAlpha * (1 - sourceAlpha)) / outputAlpha,
    );
  }
  canvas.data[offset + 3] = Math.round(outputAlpha * 255);
}

function renderFrame(canvas, image, crop, destination, clip) {
  const [cropX, cropY, cropRight, cropBottom] = crop;
  const [destinationX, destinationY, destinationWidth, destinationHeight] = destination;
  const cropWidth = cropRight - cropX;
  const cropHeight = cropBottom - cropY;
  const left = Math.floor(destinationX);
  const right = Math.ceil(destinationX + destinationWidth);
  const top = Math.floor(destinationY);
  const bottom = Math.ceil(destinationY + destinationHeight);
  for (let y = top; y < bottom; y += 1) {
    for (let x = left; x < right; x += 1) {
      if (clip && (x < clip[0] || y < clip[1] || x >= clip[2] || y >= clip[3])) continue;
      const unitX = (x + 0.5 - destinationX) / destinationWidth;
      const unitY = (y + 0.5 - destinationY) / destinationHeight;
      if (unitX < 0 || unitX >= 1 || unitY < 0 || unitY >= 1) continue;
      compositePixel(canvas, x, y, sample(image, cropX + unitX * cropWidth - 0.5, cropY + unitY * cropHeight - 0.5));
    }
  }
}

function renderFull(canvas, image, clip) {
  renderFrame(canvas, image, [0, 0, image.width, image.height], [0, 0, CANVAS, CANVAS], clip);
}

function renderPair(canvas, neutralPath, detailsPath, frame, clip) {
  const neutral = skinTint(load(neutralPath));
  const details = load(detailsPath);
  if (frame) {
    renderFrame(canvas, neutral, frame[0], frame[1], clip);
    renderFrame(canvas, details, frame[0], frame[1], clip);
  } else {
    renderFull(canvas, neutral, clip);
    renderFull(canvas, details, clip);
  }
}

function bodyLayers(bodyType) {
  const underlay = newCanvas();
  const overlay = newCanvas();
  const centralSkin = [584, 0, 670, 390];
  const legs = [0, 900, CANVAS, CANVAS];

  if (bodyType === "BOY") {
    for (const part of ["left-leg", "right-leg"]) {
      renderPair(underlay, `appearance/skin/boy/${part}-neutral.png`, `appearance/skin/boy/${part}-details.png`, undefined, legs);
    }
    for (const part of ["left-arm", "right-arm"]) {
      renderPair(underlay, `appearance/skin/boy/${part}-neutral.png`, `appearance/skin/boy/${part}-details.png`);
    }
    for (const part of ["torso", "neck"]) {
      renderPair(underlay, `appearance/skin/boy/${part}-neutral.png`, `appearance/skin/boy/${part}-details.png`, undefined, centralSkin);
    }
    renderPair(overlay, "appearance/skin/boy/head-neutral.png", "appearance/skin/boy/head-details.png");
    renderFull(overlay, multiplyTint(load("appearance/eyes/boy/iris-mask.png"), "#76503A"));
    renderFull(overlay, load("appearance/eyes/boy/eye-details.png"));
  } else {
    renderPair(underlay, "appearance/skin/girl/left-leg-neutral.png", "appearance/skin/girl/left-leg-details.png", girlFrames.leftLeg, legs);
    renderPair(underlay, "appearance/skin/girl/right-leg-neutral.png", "appearance/skin/girl/right-leg-details.png", girlFrames.rightLeg, legs);
    renderPair(underlay, "appearance/skin/girl/left-arm-neutral.png", "appearance/skin/girl/left-arm-details.png", girlFrames.leftArm);
    renderPair(underlay, "appearance/skin/girl/right-arm-neutral.png", "appearance/skin/girl/right-arm-details.png", girlFrames.rightArm);
    renderPair(underlay, "appearance/skin/girl/torso-neutral.png", "appearance/skin/girl/torso-details.png", girlFrames.torso, centralSkin);
    renderPair(underlay, "appearance/skin/girl/head-neutral.png", "appearance/skin/girl/head-details.png", girlFrames.neck, centralSkin);
    renderPair(overlay, "appearance/skin/girl/head-neutral.png", "appearance/skin/girl/head-details.png", girlFrames.head);
    renderFrame(overlay, multiplyTint(load("appearance/eyes/girl/iris-mask.png"), "#76503A"), girlFrames.head[0], girlFrames.head[1]);
    renderFrame(overlay, load("appearance/eyes/girl/eye-details.png"), girlFrames.head[0], girlFrames.head[1]);
    renderPair(overlay, "appearance/skin/girl/head-neutral.png", "appearance/skin/girl/head-details.png", girlFrames.crown);
  }
  return { underlay, overlay };
}

const bodies = { BOY: bodyLayers("BOY"), GIRL: bodyLayers("GIRL") };

function renderDress(canvas, source, metadata) {
  const [[, top, , bottom], shoulderY, waistY] = metadata;
  const bands = [
    [[0, top - 4, 1086, shoulderY], [274.05, 250, 705.9, 45]],
    [[0, shoulderY, 1086, waistY], [274.05, 295, 705.9, 275]],
    [[0, waistY, 1086, bottom + 4], [274.05, 570, 705.9, 610]],
  ];
  for (const [crop, destination] of bands) renderFrame(canvas, source, crop, destination);
}

function renderAvatar(bodyType, dress) {
  const avatar = clone(bodies[bodyType].underlay);
  renderDress(avatar, dress.image, dressFrames[dress.name]);
  renderFull(avatar, bodies[bodyType].overlay);
  return avatar;
}

function drawText(canvas, text, centerX, top, scale, color) {
  const width = text.length * 6 * scale - scale;
  let x = Math.round(centerX - width / 2);
  for (const character of text) {
    const glyph = font[character] ?? font[" "];
    for (let row = 0; row < glyph.length; row += 1) {
      for (let column = 0; column < glyph[row].length; column += 1) {
        if (glyph[row][column] !== "1") continue;
        for (let py = 0; py < scale; py += 1) {
          for (let px = 0; px < scale; px += 1) {
            const offset = ((top + row * scale + py) * canvas.width + x + column * scale + px) * 4;
            canvas.data[offset] = color[0];
            canvas.data[offset + 1] = color[1];
            canvas.data[offset + 2] = color[2];
            canvas.data[offset + 3] = 255;
          }
        }
      }
    }
    x += 6 * scale;
  }
}

function drawPanel(sheet, avatar, column, label, corrected) {
  const x = column * 400;
  for (let y = 0; y < sheet.height; y += 1) {
    const offset = (y * sheet.width + x) * 4;
    sheet.data[offset] = corrected ? 28 : 22;
    sheet.data[offset + 1] = corrected ? 48 : 29;
    sheet.data[offset + 2] = corrected ? 35 : 31;
    sheet.data[offset + 3] = 255;
  }
  drawText(sheet, label, x + 200, 18, 4, corrected ? [180, 232, 177] : [224, 224, 216]);
  renderFrame(sheet, avatar, [200, 0, 1054, 1254], [x + 20, 58, 360, 528]);
  renderFrame(sheet, avatar, [380, 170, 874, 600], [x + 20, 630, 360, 313]);
}

function renderProductionContactSheet() {
  const names = Object.keys(dressFrames);
  const sheet = newCanvas(2000, 2480, [18, 24, 20, 255]);
  for (const [bodyIndex, bodyType] of ["BOY", "GIRL"].entries()) {
    names.forEach((name, dressIndex) => {
      const source = PNG.sync.read(fs.readFileSync(path.join(assetRoot, `dresses/${name}.png`)));
      const avatar = renderAvatar(bodyType, { name, image: source });
      const column = dressIndex % 5;
      const row = bodyIndex * 2 + Math.floor(dressIndex / 5);
      const x = column * 400;
      const y = row * 620;
      drawText(sheet, `${name.replaceAll("-", " ").toUpperCase()} ${bodyType}`, x + 200, y + 20, 2, [224, 232, 218]);
      renderFrame(sheet, avatar, [200, 0, 1054, 1254], [x + 20, y + 65, 360, 529]);
    });
  }
  const output = path.join(candidateRoot, "production-dresses-boy-girl-contact-sheet.png");
  fs.writeFileSync(output, PNG.sync.write(sheet));
  console.log(`Wrote ${output}`);
}

fs.mkdirSync(comparisonRoot, { recursive: true });
const selected = process.argv.slice(2);
if (selected.length === 1 && selected[0] === "--production-contact") {
  renderProductionContactSheet();
  process.exit(0);
}
const names = selected.length > 0 ? selected : Object.keys(dressFrames);

for (const name of names) {
  if (!dressFrames[name]) throw new Error(`Unknown dress: ${name}`);
  const source = PNG.sync.read(fs.readFileSync(path.join(assetRoot, `dresses/${name}.png`)));
  const candidate = PNG.sync.read(fs.readFileSync(path.join(candidateRoot, `${name}-armhole-candidate.png`)));
  const originalBoy = renderAvatar("BOY", { name, image: source });
  const correctedBoy = renderAvatar("BOY", { name, image: candidate });
  const originalGirl = renderAvatar("GIRL", { name, image: source });
  const correctedGirl = renderAvatar("GIRL", { name, image: candidate });
  const sheet = newCanvas(1600, 970, [18, 24, 20, 255]);
  drawPanel(sheet, originalBoy, 0, "ORIGINAL BOY", false);
  drawPanel(sheet, correctedBoy, 1, "CORRECTED BOY", true);
  drawPanel(sheet, originalGirl, 2, "ORIGINAL GIRL", false);
  drawPanel(sheet, correctedGirl, 3, "CORRECTED GIRL", true);
  fs.writeFileSync(path.join(comparisonRoot, `${name}-comparison.png`), PNG.sync.write(sheet));
  console.log(`Wrote ${path.join(comparisonRoot, `${name}-comparison.png`)}`);
}
