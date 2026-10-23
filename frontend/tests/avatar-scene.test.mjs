import assert from "node:assert/strict";
import test from "node:test";
import { avatarSceneForTest } from "./notice-test-support.mjs";

test("the local default is display-only and used only without an equipped background", () => {
  const calls = [], source = { uri: "equipped.png" };
  const scene = avatarSceneForTest((...args) => { calls.push(args); return args[1] === "missing" ? undefined : source; });
  const cosmetics = Object.freeze([Object.freeze({ id: "owned", type: "BACKGROUND", equipped: false, owned: true })]);
  for (const id of [null, undefined, ""]) assert.equal(scene.getAvatarSceneSource(cosmetics, id), scene.DEFAULT_AVATAR_SCENE);
  assert.equal(scene.getAvatarSceneSource([], null), scene.DEFAULT_AVATAR_SCENE);
  assert.equal(scene.getAvatarSceneSource(undefined, undefined), scene.DEFAULT_AVATAR_SCENE);
  assert.equal(calls.length, 0, "no catalog, purchase or ownership lookup is needed for the default");
  for (const id of ["owned", 7]) {
    assert.equal(scene.getAvatarSceneSource(cosmetics, id), source);
    assert.deepEqual(calls.at(-1), [cosmetics, id, "BACKGROUND"]);
  }
  assert.equal(scene.getAvatarSceneSource(cosmetics, "missing"), undefined, "preserve unavailable-equipped behavior");
  assert.deepEqual(cosmetics, [{ id: "owned", type: "BACKGROUND", equipped: false, owned: true }]);
});
