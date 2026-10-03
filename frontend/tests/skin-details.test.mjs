import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { PNG } from "pngjs";

import { SKIN_COLORS } from "../src/avatar/appearance.ts";
import { skinDetailMatrix, SKIN_DETAIL_NEUTRAL_MASKS } from "../src/avatar/colorize.ts";

const clamp = value => Math.max(0, Math.min(1, value));
const linear = value => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
const srgb = value => value <= 0.0031308 ? value * 12.92 : 1.055 * value ** (1 / 2.4) - 0.055;
const apply = (matrix, rgba) => [0, 5, 10, 15].map(offset => clamp(
  rgba.reduce((sum, value, index) => sum + value * matrix[offset + index], matrix[offset + 4]),
));

// Mirrors the actual filter: neutral mask -> adapted RGB -> source-atop the
// existing desaturated image. Atop (not over) preserves its original alpha.
function detailPixel(rgba, color, space) {
  const input = rgba.map((value, index) => index < 3 && space === "linearRGB" ? linear(value) : value);
  const gray = input[0] * 0.2126 + input[1] * 0.7152 + input[2] * 0.0722;
  const matrix = skinDetailMatrix(color, space);
  const mask = matrix ? SKIN_DETAIL_NEUTRAL_MASKS.reduce((alpha, maskMatrix) => alpha * apply(maskMatrix, input)[3], 1) : 0;
  const adapted = matrix ? apply(matrix, input) : [gray, gray, gray];
  return [...adapted.slice(0, 3).map(value => {
    const output = value * mask + gray * (1 - mask);
    return space === "linearRGB" ? srgb(output) : output;
  }), rgba[3]];
}

test("skin detail adaptation leaves the ten light/medium presets on their exact existing path", () => {
  assert.deepEqual(SKIN_COLORS.map(({ id, color }) => [id, color]), [
    ["skin_01", "#F2D6C9"], ["skin_02", "#EFC9B1"], ["skin_03", "#E4C0AF"], ["skin_04", "#DEB599"],
    ["skin_05", "#D0AB96"], ["skin_06", "#C99C7E"], ["skin_07", "#B9907A"], ["skin_08", "#B18462"],
    ["skin_09", "#A17A66"], ["skin_10", "#986D52"], ["skin_11", "#896451"], ["skin_12", "#805943"],
    ["skin_13", "#6E5145"], ["skin_14", "#634735"], ["skin_15", "#513B32"], ["skin_16", "#443127"],
  ]);
  for (const { color } of SKIN_COLORS.slice(0, 10)) {
    for (const space of ["sRGB", "linearRGB"]) assert.equal(skinDetailMatrix(color, space), null);
  }
});

test("all sixteen presets preserve alpha and readable, ordered detail contrast in both filter color spaces", () => {
  for (const { color } of SKIN_COLORS) for (const space of ["sRGB", "linearRGB"]) {
    let previous = [-1, -1, -1];
    for (const gray of [0, 0.15, 0.3, 0.5, 0.75, 1]) {
      for (const alpha of [0, 1 / 255, 0.25, 0.5, 1]) {
        const output = detailPixel([gray, gray, gray, alpha], color, space);
        assert.equal(output[3], alpha);
        if (gray === 0) assert.deepEqual(output.slice(0, 3), [0, 0, 0], "dark outlines are not lifted");
      }
      const rgb = detailPixel([gray, gray, gray, 1], color, space).slice(0, 3);
      rgb.forEach((value, index) => assert.ok(value > previous[index], "do not flatten highlights or shadows"));
      previous = rgb;
    }
    const matrix = skinDetailMatrix(color, space);
    if (matrix) {
      assert.deepEqual(matrix.slice(15), [0, 0, 0, 1, 0]);
      for (const index of [3, 4, 8, 9, 13, 14]) assert.equal(matrix[index], 0);
    }
  }
});

test("darkest skin caps white details at the selected tone plus a 25 percent warm highlight", () => {
  const { color } = SKIN_COLORS.at(-1);
  const tone = [1, 3, 5].map(offset => parseInt(color.slice(offset, offset + 2), 16) / 255);
  for (const space of ["sRGB", "linearRGB"]) {
    const white = detailPixel([1, 1, 1, 0.5], color, space);
    white.slice(0, 3).forEach((value, index) => assert.ok(Math.abs(value - tone[index] * 1.25) < 1e-12));
    assert.ok(white[0] < 0.34 && white[0] > white[1] && white[1] > white[2]);
    const contour = detailPixel([0.5, 0.5, 0.5, 1], color, space);
    assert.ok(contour[0] < tone[0] && contour[0] > 0.1, "contours remain readable, not white or erased");
  }
});

test("existing mixed-detail starter clothing retains its chromatic pixels rather than receiving skin tint", () => {
  for (const part of ["boy/torso", "boy/left-leg", "boy/right-leg", "girl/torso"]) {
    const png = PNG.sync.read(readFileSync(new URL(`../assets/avatar/v2/appearance/skin/${part}-details.png`, import.meta.url)));
    let clothingPixels = 0;
    for (let i = 0; i < png.data.length; i += 4) {
      const [r, g, b, a] = png.data.subarray(i, i + 4);
      if (a <= 32 || r === g && g === b) continue;
      assert.notEqual(r, b, `${part}: non-neutral clothing must remain outside the neutral detail mask`);
      for (const space of ["sRGB", "linearRGB"]) {
        const input = [r, g, b, a].map(value => value / 255);
        const before = detailPixel(input, SKIN_COLORS[0].color, space);
        const after = detailPixel(input, SKIN_COLORS.at(-1).color, space);
        assert.deepEqual(after, before, `${part}: clothing shading must not change`);
      }
      clothingPixels++;
    }
    assert.ok(clothingPixels > 1000, `${part}: exercise actual tank/shorts pixels`);
  }
});

test("adaptive filtering remains inside the existing skin-detail branch and restores source alpha", () => {
  const layers = readFileSync(new URL("../src/components/CharacterSpriteLayers.tsx", import.meta.url), "utf8");
  assert.match(layers, /skinDetailMatrix\(tintColors.skin, FILTER_COLOR_SPACE\)/);
  assert.match(layers, /FeComposite in="adapted" in2="neutral" operator="atop"/);
  assert.match(layers, /neutralDetails \? `url\(#\$\{id\}-neutral-details\)`/);
  assert.match(layers, /values=\{avatarTintMatrix\(channel as "skin" \| "hair" \| "eyes", color, FILTER_COLOR_SPACE\)\}/);
});
