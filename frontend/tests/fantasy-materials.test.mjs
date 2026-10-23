import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import ts from "typescript";
import * as runtime from "react/jsx-runtime";
import { nineSliceRegions } from "../src/theme/nineSlice.ts";

const manifest = JSON.parse(readFileSync(new URL("../assets/ui/fantasy/manifest.json", import.meta.url), "utf8"));

test("iOS, Android and web compose the same image crops in real clipping Views without SVG positioning", () => {
  const registry = {};
  new Function("exports", "require", ts.transpileModule(readFileSync(new URL("../src/theme/fantasyMaterials.ts", import.meta.url), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
  }).outputText)(registry, path => path);
  const code = ts.transpileModule(readFileSync(new URL("../src/components/ui/FantasyMaterial.tsx", import.meta.url), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  for (const OS of ["ios", "android", "web"]) {
    let state = { width: 0, height: 0 };
    const exports = {}, imports = {
      react: { memo: fn => fn, useState: () => [state, update => { state = update(state); }] },
      "react/jsx-runtime": runtime,
      "react-native": { View: "View", Image: "Image", Platform: { OS }, StyleSheet: { create: value => value, absoluteFill: { position: "absolute" } } },
      "../../theme/fantasyMaterials": registry, "../../theme/nineSlice": { nineSliceRegions },
    };
    new Function("exports", "require", code)(exports, id => { assert.ok(id in imports, `Unexpected native material dependency ${id}`); return imports[id]; });
    for (const [kind, material] of Object.entries(registry.fantasyMaterials)) {
      for (const [width, height] of [[58, 54], [350, 52], [88, 36], [430, 98]]) {
        let tree = exports.default({ kind });
        tree.props.onLayout({ nativeEvent: { layout: { width, height } } });
        tree = exports.default({ kind });
        const regions = nineSliceRegions(width, height, material);
        assert.equal(tree.props.accessible, false);
        assert.equal(tree.props.pointerEvents, "none");
        tree.props.children.forEach((clip, index) => {
          const r = regions[index], image = clip.props.children, s = image.props.style;
          assert.equal(clip.type, "View"); assert.equal(clip.props.collapsable, false);
          assert.equal(clip.props.style.overflow, "hidden");
          assert.equal(image.type, "Image"); assert.equal(image.props.resizeMode, "stretch");
          assert.equal(image.props.source, material.source);
          assert.equal(image.props.fadeDuration, OS === "android" ? 0 : undefined);
          assert.ok(Math.abs(-s.left / s.width * material.width - r.sx) < 0.001);
          assert.ok(Math.abs(-s.top / s.height * material.height - r.sy) < 0.001);
          assert.ok(Math.abs(clip.props.style.width / s.width * material.width - r.sw) < 0.001);
          assert.ok(Math.abs(clip.props.style.height / s.height * material.height - r.sh) < 0.001);
        });
      }
    }
  }
});

test("illustrated material slices cover responsive controls while preserving corner proportions", () => {
  for (const entry of manifest.filter(row => row.density)) {
    const material = { width: entry.size[0], height: entry.size[1], density: entry.density, caps: entry.capsLTRB };
    for (const [width, height] of [[58, 54], [350, 52], [358, 400], [430, 98], [18, 14]]) {
      const regions = nineSliceRegions(width, height, material);
      const area = regions.reduce((sum, region) => sum + region.width * region.height, 0);
      assert.ok(Math.abs(area - width * height) < 0.001, `${entry.role} must cover the surface`);
      const corner = regions[0];
      assert.ok(Math.abs(corner.width / corner.sw - corner.height / corner.sh) < 0.001, `${entry.role} corner must keep its aspect ratio`);
      for (const region of regions) {
        assert.ok(region.x >= 0 && region.y >= 0 && region.width > 0 && region.height > 0);
        assert.ok(region.x + region.width <= width + 0.001 && region.y + region.height <= height + 0.001);
      }
    }
  }
  assert.deepEqual(nineSliceRegions(0, 30, { width: 100, height: 100, density: 2, caps: [10, 10, 10, 10] }), []);
});

test("all eight supplied materials have optimized local PNGs with matching registered dimensions", () => {
  assert.equal(manifest.length, 8);
  const source = readFileSync(new URL("../src/theme/fantasyMaterials.ts", import.meta.url), "utf8");
  const registry = {};
  new Function("exports", "require", ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText)(registry, path => path);
  const slices = Object.values(registry.fantasyMaterials);
  for (const entry of manifest) {
    const png = readFileSync(new URL(`../assets/ui/fantasy/${entry.role}.png`, import.meta.url));
    assert.deepEqual([png.readUInt32BE(16), png.readUInt32BE(20)], entry.size);
    assert.ok(png.length < entry.sourceBytes, `${entry.role} should be smaller than its supplied original`);
    assert.ok(source.includes(`assets/ui/fantasy/${entry.role}.png`), `${entry.role} must resolve statically`);
    if (entry.density) {
      const material = slices.find(row => row.source.endsWith(`/${entry.role}.png`));
      assert.deepEqual([material.width, material.height, material.density, ...material.caps], [...entry.size, entry.density, ...entry.capsLTRB]);
    }
  }
});
