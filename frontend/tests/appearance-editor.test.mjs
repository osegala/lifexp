import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import test from "node:test";
import ts from "typescript";

import * as appearance from "../src/avatar/appearance.ts";
import * as inventory from "../src/avatar/inventory.ts";
import * as theme from "../src/theme/theme.ts";
import { apiError } from "../src/api/errors.ts";
import { validateProfilePatch } from "../../backend/functions/update-me/logic.mjs";
import { APPEARANCE_VALUES } from "../../backend/layers/api-shared/nodejs/appearance.mjs";

const require = createRequire(import.meta.url);
const native = Object.fromEntries(["ActivityIndicator", "Image", "Modal", "Pressable", "ScrollView", "Text", "View"].map(name => [name, name]));
native.StyleSheet = { create: value => value };
native.useWindowDimensions = () => ({ width: 375, height: 812 });
// Match React Native Web: an Alert cannot be used to close a dirty editor.
native.Alert = { alert() {} };

function load(path, imports) {
  const exports = {};
  const code = ts.transpileModule(readFileSync(new URL(path, import.meta.url), "utf8"), {
    compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, esModuleInterop: true },
  }).outputText;
  new Function("exports", "require", "__DEV__", code)(exports, id => {
    if (id === "react/jsx-runtime") return require(id);
    if (!(id in imports)) throw new Error(`Unmocked import: ${id}`);
    return imports[id];
  }, false);
  return exports.default;
}

function nodes(tree) {
  if (Array.isArray(tree)) return tree.flatMap(nodes);
  if (!tree?.props) return [];
  return [tree, ...nodes(tree.props.children)];
}
const text = tree => typeof tree === "string" ? tree : Array.isArray(tree)
  ? tree.map(text).join("") : tree?.props ? text(tree.props.children) : "";
const button = (tree, label) => nodes(tree).find(node => node.type === "Pressable"
  && (node.props.accessibilityLabel === label || text(node) === label));

const Editor = load("../src/components/AppearanceEditor.tsx", {
  "react-native": native, "../avatar/appearance": appearance, "../theme/theme": theme, "./LifeCard": "LifeCard",
});

async function screen({ validatePatch = () => {} } = {}) {
  let index = 0, focus;
  const state = [], patches = [], cached = [];
  let profile = { ...appearance.DEFAULT_APPEARANCE, bodyType: "GIRL" };
  const api = {
    get: async route => ({ data: route === "me" ? profile : route === "shop" ? { items: [] }
      : { items: [], equipped: {} } }),
    patch: async (route, value) => {
      patches.push({ route, value });
      validatePatch(value);
      profile = { ...value };
      return { data: profile };
    },
  };
  const Component = load("../app/(tabs)/avatar.tsx", {
    "react": {
      useState: initial => {
        const key = index++;
        if (!(key in state)) state[key] = initial;
        return [state[key], value => { state[key] = typeof value === "function" ? value(state[key]) : value; }];
      },
      useCallback: fn => fn,
      useMemo: fn => fn(),
    },
    "react-native": native,
    "expo-router": { useFocusEffect: fn => { focus = fn; } },
    "@expo/vector-icons/MaterialCommunityIcons": "Icon",
    "../../src/api/client": { api, apiError },
    "../../src/api/routes": { apiRoutes: { me: "me", shop: "shop", inventory: "inventory" } },
    "../../src/avatar/assetRegistry": { getCosmeticAssetIds: () => [], getEquippedSceneSource: () => undefined },
    "../../src/avatar/inventory": inventory,
    "../../src/avatar/localAppearance": {
      getLocalAppearance: async () => profile,
      setLocalAppearance: async (id, value) => { cached.push({ id, value }); },
    },
    "../../src/avatar/appearance": appearance,
    "../../src/components/CosmeticImage": "CosmeticImage",
    "../../src/components/AvatarRenderer": "AvatarRenderer",
    "../../src/components/AppearanceEditor": "AppearanceEditor",
    "../../src/components/LifeCard": "LifeCard",
    "../../src/context/AuthContext": { useAuth: () => ({ user: { id: "test-user" } }) },
    "../../src/theme/theme": theme,
    "../../src/config/environment": { environment: { environment: "dev" } },
  });
  const render = () => { index = 0; return Component(); };
  render();
  focus();
  await new Promise(setImmediate);
  const editor = () => nodes(render()).find(node => node.type === "AppearanceEditor")?.props;
  return {
    render, patches, cached,
    editor,
    editorTree: () => Editor(editor()),
    pressSave: () => {
      const save = button(Editor(editor()), "Save appearance");
      assert.ok(save && !save.props.disabled, "Save appearance must be enabled");
      save.props.onPress();
    },
    modal: () => nodes(render()).find(node => node.type === "Modal")?.props,
    press: label => {
      const target = button(render(), label);
      assert.ok(target, `Missing button: ${label}`);
      assert.ok(!target.props.disabled, `${label} is disabled`);
      target.props.onPress();
    },
  };
}

test("appearance X closes clean edits and offers working keep/discard actions without native alerts", async () => {
  const ui = await screen();
  ui.press("Edit Appearance");
  assert.equal(ui.modal().visible, true);
  ui.press("Close appearance editor");
  assert.equal(ui.modal().visible, false);
  ui.press("Edit Appearance");
  const saved = ui.editor().appearance;
  ui.editor().onChange({ skinColorId: "skin_16", hairColorId: "black", eyeColorId: "green" });
  ui.press("Close appearance editor");
  assert.equal(ui.modal().visible, true);
  assert.match(text(ui.render()), /Discard appearance changes\?/);
  ui.press("Keep Editing");
  assert.equal(ui.editor().appearance.skinColorId, "skin_16");
  ui.modal().onRequestClose(); // Android back / web Escape use the same safe path.
  ui.press("Discard Changes");
  assert.equal(ui.modal().visible, false);
  ui.press("Edit Appearance");
  assert.deepEqual(ui.editor().appearance, saved);
  assert.equal(ui.patches.length, 0, "discard must never save a draft");
});

test("every skin tone saves through the existing profile contract and survives reopening", async () => {
  const ui = await screen();
  for (const { id } of appearance.SKIN_COLORS) {
    ui.press("Edit Appearance");
    ui.editor().onChange({ skinColorId: id });
    ui.pressSave();
    assert.equal(button(ui.render(), "Close appearance editor").props.disabled, true);
    ui.modal().onRequestClose();
    assert.equal(ui.modal().visible, true, "do not discard during an in-flight save");
    await new Promise(setImmediate);
    assert.equal(ui.modal().visible, false);
    ui.press("Edit Appearance");
    assert.equal(ui.editor().appearance.skinColorId, id);
    assert.equal(ui.editor().dirty, false);
    ui.press("Close appearance editor");
  }
  assert.equal(ui.patches.length, 16);
  for (const { route, value } of ui.patches) {
    assert.equal(route, "me");
    assert.deepEqual(Object.keys(value).sort(), Object.keys(appearance.DEFAULT_APPEARANCE).sort());
  }
  assert.ok(ui.cached.every(({ id }) => id === "test-user"));
});

test("skin swatches retain saved IDs, inclusive depth/undertone labels, and accessible selection", () => {
  const colors = appearance.SKIN_COLORS;
  assert.deepEqual(colors.map(({ id }) => id), Array.from({ length: 16 }, (_, index) => `skin_${String(index + 1).padStart(2, "0")}`));
  let previous = Infinity;
  for (const { name, color } of colors) {
    assert.match(name, /^(Very light|Light|Light-medium|Medium|Medium-deep|Deep|Very deep|Deepest) (neutral|warm)$/);
    assert.match(color, /^#[0-9A-F]{6}$/);
    const [r, g, b] = [1, 3, 5].map(offset => parseInt(color.slice(offset, offset + 2), 16));
    const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    assert.ok(luminance < previous, "saved IDs must remain ordered light to deep");
    previous = luminance;
  }
  const Editor = load("../src/components/AppearanceEditor.tsx", {
    "react-native": native, "../avatar/appearance": appearance, "../theme/theme": theme, "./LifeCard": "LifeCard",
  });
  const changes = [];
  const tree = Editor({ appearance: appearance.DEFAULT_APPEARANCE, onChange: patch => changes.push(patch), dirty: false, saving: false });
  const Swatches = nodes(tree).find(node => node.props.label === "Skin tone");
  const swatches = Swatches.type(Swatches.props);
  const radios = nodes(swatches).filter(node => node.props.accessibilityRole === "radio");
  assert.equal(radios.length, 16);
  assert.equal(radios.filter(node => node.props.accessibilityState.checked).length, 1);
  assert.equal(radios.filter(node => node.props["aria-checked"]).length, 1);
  assert.match(text(swatches), /Light warm/);
  for (const [index, radio] of radios.entries()) {
    assert.equal(radio.props.accessibilityLabel, `Skin tone: ${colors[index].name}`);
    assert.equal(radio.props["aria-checked"], radio.props.accessibilityState.checked);
    const style = radio.props.style({ pressed: false }).filter(Boolean);
    assert.ok(style[0].width >= 44 && style[0].height >= 44);
    radio.props.onPress();
  }
  assert.deepEqual(changes, colors.map(({ id }) => ({ skinColorId: id })));
});

test("all new hairstyles save through PATCH me and survive closing and reopening", async () => {
  const ui = await screen();
  for (const hairId of appearance.HAIR_STYLE_IDS.slice(10)) {
    ui.press("Edit Appearance");
    ui.editor().onChange({ hairId });
    ui.pressSave();
    await new Promise(setImmediate);
    assert.equal(ui.modal().visible, false);
    ui.press("Edit Appearance");
    assert.equal(ui.editor().appearance.hairId, hairId);
    assert.equal(ui.editor().dirty, false);
    ui.press("Close appearance editor");
  }
  assert.deepEqual(ui.patches.map(({ value }) => value.hairId), appearance.HAIR_STYLE_IDS.slice(10));
  assert.ok(ui.patches.every(({ route }) => route === "me"));
  assert.ok(ui.cached.every(({ id }) => id === "test-user"));
});

test("a server without the new hair IDs shows an inline save error and allows recovery", async () => {
  const ui = await screen({ validatePatch(value) {
    try {
      validateProfilePatch(value, { ...APPEARANCE_VALUES, hairId: APPEARANCE_VALUES.hairId.slice(0, 10) });
    } catch ({ code, message }) {
      throw { response: { data: { error: { code, message } } } };
    }
  } });
  ui.press("Edit Appearance");
  ui.editor().onChange({ hairId: "avatar-v2/hair/cornrows", skinColorId: "skin_16" });
  const draft = ui.editor().appearance;
  const cacheBeforeSave = [...ui.cached];
  ui.pressSave();
  assert.equal(ui.editor().saving, true);
  await new Promise(setImmediate);
  const error = nodes(ui.editorTree()).find(node => node.props.accessibilityRole === "alert");
  assert.ok(error, "a rejected save must be visible even when native Alert is a no-op");
  assert.match(text(error), /not saved.*server.*hairstyle.*choose another/is);
  assert.equal(ui.modal().visible, true);
  assert.equal(ui.editor().saving, false);
  assert.equal(ui.editor().dirty, true);
  assert.deepEqual(ui.editor().appearance, draft);
  assert.deepEqual(ui.cached, cacheBeforeSave, "never cache a rejected save as persisted");
  assert.equal(button(ui.editorTree(), "Save appearance").props.disabled, false);

  ui.editor().onChange({ hairId: appearance.DEFAULT_APPEARANCE.hairId });
  assert.equal(nodes(ui.editorTree()).some(node => node.props.accessibilityRole === "alert"), false);
  ui.pressSave();
  await new Promise(setImmediate);
  assert.equal(ui.modal().visible, false);
  ui.press("Edit Appearance");
  assert.equal(ui.editor().appearance.skinColorId, "skin_16");
  assert.equal(ui.editor().appearance.hairId, appearance.DEFAULT_APPEARANCE.hairId);
  assert.equal(ui.editor().dirty, false);
});

test("network save errors stay visible beside Save, preserve the draft, and permit retry", async () => {
  let failing = true;
  const ui = await screen({ validatePatch() { if (failing) throw new Error("network unavailable"); } });
  ui.press("Edit Appearance");
  ui.editor().onChange({ eyeColorId: "green" });
  ui.pressSave();
  await new Promise(setImmediate);
  assert.match(text(ui.editorTree()), /Appearance not saved.*try again/is);
  assert.equal(ui.editor().appearance.eyeColorId, "green");
  assert.equal(ui.editor().dirty, true);
  failing = false;
  ui.pressSave();
  assert.doesNotMatch(text(ui.editorTree()), /Appearance not saved/);
  await new Promise(setImmediate);
  assert.equal(ui.modal().visible, false);
  ui.press("Edit Appearance");
  assert.equal(ui.editor().appearance.eyeColorId, "green");
  assert.equal(ui.editor().dirty, false);
});

test("hair picker exposes all 20 names, checked state, and 44-point targets", () => {
  const Editor = load("../src/components/AppearanceEditor.tsx", {
    "react-native": native, "../avatar/appearance": appearance, "../theme/theme": theme, "./LifeCard": "LifeCard",
  });
  for (const hairId of appearance.HAIR_STYLE_IDS) {
    const changes = [];
    const tree = Editor({ appearance: { ...appearance.DEFAULT_APPEARANCE, hairId }, onChange: patch => changes.push(patch) });
    const group = nodes(tree).find(node => node.props.accessibilityLabel === "Hair style");
    const radios = nodes(group).filter(node => node.props.accessibilityRole === "radio");
    assert.equal(radios.length, 20);
    assert.equal(radios.filter(node => node.props.accessibilityState.checked).length, 1);
    const selected = radios.find(node => node.props["aria-checked"]);
    assert.equal(selected.key, hairId);
    assert.equal(selected.props.accessibilityLabel, `Hair style: ${text(selected)}`);
    assert.ok(nodes(tree).some(node => node.props.accessibilityLiveRegion === "polite" && text(node) === text(selected)));
    for (const radio of radios) {
      assert.ok(radio.props.style({ pressed: false })[0].minHeight >= 44);
      radio.props.onPress();
    }
    assert.deepEqual(changes, appearance.HAIR_STYLE_IDS.map(hairId => ({ hairId })));
  }
});
