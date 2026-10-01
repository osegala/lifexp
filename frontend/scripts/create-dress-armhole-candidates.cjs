/* global Buffer */
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const { PNG } = require("pngjs");

const repositoryRoot = path.resolve(__dirname, "../..");
const sourceRoot = path.join(repositoryRoot, "frontend/assets/avatar/v2/dresses");
const candidateRoot = path.join(repositoryRoot, "frontend/artwork-candidates/avatar/v2/dresses");

const dresses = {
  starlight: {
    sha256: "c0e8d5dda55244f89f9b536d21348d82610d004e43fb871591516a2e8b5dabc1",
    leftRearRim: [
      [370, 222], [383, 211], [396, 219], [392, 244], [389, 275], [388, 315],
      [384, 347], [374, 382], [378, 401], [365, 410], [354, 389], [359, 369],
      [366, 342], [369, 310], [369, 270], [364, 240],
    ],
  },
  frostbound: {
    sha256: "d796a68efcc5f9f3893dfe144966494e6129fe95456032819eacc0b4de5a74bb",
    leftRearRim: [
      [358, 229], [370, 215], [386, 224], [383, 250], [381, 290], [380, 326],
      [376, 353], [365, 382], [370, 399], [357, 408], [344, 388], [349, 370],
      [355, 345], [358, 315], [358, 275], [352, 244],
    ],
  },
  "teal-wayfarer": {
    sha256: "8ca504cf5b237add5437ef90a935b0e77fed0db4883a9fe66a3b2c4d4b530ea2",
    leftRearRim: [
      [358, 196], [372, 182], [386, 190], [383, 215], [380, 245], [380, 290],
      [381, 321], [374, 351], [365, 373], [370, 389], [356, 397], [345, 377],
      [350, 358], [357, 333], [360, 303], [360, 260], [359, 225], [352, 207],
    ],
  },
  "crimson-guard": {
    sha256: "32fd7cffa8be700ed37278208cbe67daedd5add116765534a0b47eeb5c48755c",
    leftRearRim: [
      [352, 181], [366, 168], [383, 176], [379, 201], [376, 230], [375, 273],
      [376, 305], [372, 332], [362, 355], [370, 371], [357, 384], [344, 361],
      [347, 341], [353, 316], [355, 285], [355, 241], [353, 205], [346, 190],
    ],
  },
  "royal-vanguard": {
    sha256: "a0103fba76a83326235212c9efc9be357cfd2c31c834b7de8a8fddabd80060c9",
    leftRearRim: [
      [344, 206], [357, 192], [375, 201], [372, 228], [369, 260], [368, 305],
      [368, 337], [364, 367], [354, 390], [361, 409], [347, 420], [334, 397],
      [337, 375], [343, 348], [345, 316], [345, 270], [342, 235], [335, 218],
    ],
  },
  "royal-bard": {
    sha256: "341812ab267bcbbfc8fe5480e89c4de7995a51050584c7c7a46ebe5a34e80492",
    leftRearRim: [
      [355, 210], [369, 197], [384, 206], [381, 232], [378, 262], [377, 307],
      [378, 338], [374, 366], [364, 389], [371, 405], [358, 416], [345, 394],
      [349, 374], [355, 348], [358, 316], [358, 272], [356, 238], [348, 221],
    ],
  },
  "harbor-scout": {
    sha256: "b7e71fe99e3f3f4bc0ee674a45ed12591351be55e90b70ce3ed002af38c3c78d",
    leftRearRim: [
      [348, 206], [363, 191], [391, 203], [387, 230], [384, 260], [383, 303],
      [382, 334], [375, 362], [362, 384], [370, 402], [356, 415], [340, 393],
      [344, 372], [350, 347], [353, 317], [353, 273], [349, 236], [341, 219],
    ],
  },
  "verdant-warden": {
    sha256: "c637290fcf6164c7c1cbf6b0a639829c481c62fb8ab37e5c974e5d89275e8a78",
    leftRearRim: [
      [365, 226], [378, 213], [393, 221], [389, 246], [386, 276], [385, 319],
      [386, 350], [381, 376], [371, 397], [377, 412], [363, 421], [350, 400],
      [354, 379], [361, 354], [364, 324], [364, 280], [362, 246], [356, 235],
    ],
  },
  "celestial-acolyte": {
    sha256: "883da64362b51c3f86d4e28ea8cd588385db9c6bfcc560717d61c4bcfb109793",
    leftRearRim: [
      [362, 207], [376, 193], [392, 201], [388, 226], [385, 256], [384, 298],
      [386, 327], [381, 352], [371, 374], [379, 390], [366, 402], [351, 381],
      [355, 360], [362, 336], [364, 307], [364, 266], [362, 233], [355, 217],
    ],
  },
};

function sha256(buffer) {
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

function contains(polygon, x, y) {
  let inside = false;
  for (let current = 0, previous = polygon.length - 1; current < polygon.length; previous = current++) {
    const [cx, cy] = polygon[current];
    const [px, py] = polygon[previous];
    if (((cy > y) !== (py > y)) && x < ((px - cx) * (y - cy)) / (py - cy) + cx) inside = !inside;
  }
  return inside;
}

fs.mkdirSync(candidateRoot, { recursive: true });
const results = [];

for (const [name, definition] of Object.entries(dresses)) {
  const sourcePath = path.join(sourceRoot, `${name}.png`);
  const candidatePath = path.join(candidateRoot, `${name}-armhole-candidate.png`);
  const sourceBuffer = fs.readFileSync(sourcePath);
  assert.equal(sha256(sourceBuffer), definition.sha256, `${name} source checksum changed`);
  const source = PNG.sync.read(sourceBuffer);
  const candidate = PNG.sync.read(sourceBuffer);
  assert.deepEqual([source.width, source.height], [1086, 1448], `${name} dimensions`);

  const regions = [
    definition.leftRearRim,
    definition.leftRearRim.map(([x, y]) => [source.width - 1 - x, y]),
  ];
  let clearedPixels = 0;

  for (let y = 0; y < source.height; y += 1) {
    for (let x = 0; x < source.width; x += 1) {
      if (!regions.some((polygon) => contains(polygon, x + 0.5, y + 0.5))) continue;
      const offset = (y * source.width + x) * 4;
      if (candidate.data[offset + 3] === 0) continue;
      candidate.data.fill(0, offset, offset + 4);
      clearedPixels += 1;
    }
  }

  assert.ok(clearedPixels > 1000 && clearedPixels < 15000, `${name} unexpected edit size`);
  const candidateBuffer = PNG.sync.write(candidate);
  fs.writeFileSync(candidatePath, candidateBuffer);

  let changedPixels = 0;
  for (let y = 0; y < source.height; y += 1) {
    for (let x = 0; x < source.width; x += 1) {
      const offset = (y * source.width + x) * 4;
      const sourcePixel = source.data.subarray(offset, offset + 4);
      const candidatePixel = candidate.data.subarray(offset, offset + 4);
      if (sourcePixel.equals(candidatePixel)) continue;
      changedPixels += 1;
      assert.ok(regions.some((polygon) => contains(polygon, x + 0.5, y + 0.5)), `${name} change outside armholes`);
      assert.deepEqual([...candidatePixel], [0, 0, 0, 0], `${name} changed pixel was not cleared`);
    }
  }
  assert.equal(changedPixels, clearedPixels);

  results.push({
    name,
    sourceSha256: definition.sha256,
    candidateSha256: sha256(candidateBuffer),
    dimensions: [candidate.width, candidate.height],
    clearedPixels,
    outsideArmholesByteIdentical: true,
  });
}

console.log(JSON.stringify(results, null, 2));
