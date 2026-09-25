import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import test from "node:test";

const avatarRegistry = readFileSync(new URL("../src/avatar/assetRegistry.ts", import.meta.url), "utf8");
const mapRegistry = readFileSync(new URL("../src/base/mapAssetRegistry.ts", import.meta.url), "utf8");
const cosmetics = JSON.parse(readFileSync(new URL("../../backend/seeds/cosmetics.json", import.meta.url), "utf8"));

const achievementAssetKeys = {
  forestbound_tunic: "avatar-v2/tops/crimson-guard",
  forestbound_dress: "avatar-v2/dresses/forest-ranger",
  forestbound_cap: "avatar-v2/hats/forest-ranger-hat",
  starweaver_tunic: "avatar-v2/tops/forest-ranger",
  starweaver_dress: "avatar-v2/dresses/starlight",
  starweaver_hat: "avatar-v2/hats/starlight-hat",
  dawnkeeper_tunic: "avatar-v2/tops/midnight-vanguard",
  dawnkeeper_dress: "avatar-v2/dresses/celestial-acolyte",
  dawnkeeper_headpiece: "avatar-v2/hats/celestial-acolyte-hat",
  mossling: "avatar-v2/pets/moss-golem",
  emberfox: "avatar-v2/pets/sunfire-fox",
  moonwing: "avatar-v2/pets/scholar-owl",
};

test("achievement cosmetics use existing central avatar registry keys", () => {
  const byId = new Map(cosmetics.map((item) => [item.itemId, item]));
  for (const [itemId, assetKey] of Object.entries(achievementAssetKeys)) {
    assert.equal(byId.get(itemId)?.assetKey, assetKey, itemId);
    assert.match(avatarRegistry, new RegExp(`"${assetKey}":`), assetKey);
  }
});

test("all extracted terrain and decoration art is statically registered", () => {
  for (const name of ["grass", "grass-grass", "grass-flowers", "grass-rocks", "grass-worn"]) {
    assert.match(mapRegistry, new RegExp(`assets/base/tiles/${name}\\.png`), name);
  }
  assert.match(mapRegistry, /assets\/base\/decorations\/stone-wall\.png/);
});

test("complete asset inventory and static reference audit passes", () => {
  const result = spawnSync(process.execPath, ["scripts/audit-assets.js"], {
    cwd: new URL("..", import.meta.url),
    encoding: "utf8",
  });
  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
  assert.match(result.stdout, /All \d+ image assets are inventoried/);
});
