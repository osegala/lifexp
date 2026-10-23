import { memoryCache } from "./cache-test-support.mjs";
import * as runtime from "react/jsx-runtime";
import { readFileSync } from "node:fs";
import ts from "typescript";
import * as timeZone from "../src/utils/timeZone.ts";

const sceneCode = ts.transpileModule(readFileSync(new URL("../src/avatar/scene.ts", import.meta.url), "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS },
}).outputText;
export function avatarSceneForTest(resolveEquipped) {
  const exports = {};
  new Function("exports", "require", sceneCode)(exports, id => {
    if (id === "./assetRegistry") return { getEquippedSceneSource: resolveEquipped };
    if (id.endsWith("/castle-garden.png")) return "local-castle-garden.png";
    throw new Error(`Unexpected scene dependency ${id}`);
  });
  return exports;
}

// Contract seam for screen/controller tests; GameNotice itself is tested separately.
const propsFor = (type, props) => type === "GameNotice" ? { ...props,
  accessibilityRole: props.variant === "error" ? "alert" : undefined,
  children: [props.title, props.message, props.children] } : props;
export const noticeJsxRuntime = { ...runtime,
  jsx: (type, props, key) => runtime.jsx(type, propsFor(type, props), key),
  jsxs: (type, props, key) => runtime.jsxs(type, propsFor(type, props), key),
};
export function noticeImport(id, imports) {
  if (id.endsWith("/entitlements/useEntitlements") && !(id in imports)) return { useEntitlements: () => ({ loading: false, premium: false }) };
  if (id.endsWith("/cache/playerData") && !(id in imports)) return { playerCache: memoryCache().cache };
  if (id.endsWith("/utils/timeZone")) return timeZone;
  if (id.endsWith("/ButtonSurface")) return { __esModule: true, default: "ButtonSurface", buttonHitArea: { backgroundColor: "transparent", borderWidth: 0, shadowOpacity: 0, elevation: 0 } };
  if (id.endsWith("/FantasyMaterial")) return "FantasyMaterial";
  if (id.endsWith("/avatar/scene")) return avatarSceneForTest(
    Object.entries(imports).find(([path]) => path.endsWith("/avatar/assetRegistry"))?.[1].getEquippedSceneSource,
  );
  if (id.endsWith("/ui/Buttons")) return {
    PrimaryButton: "Button", SecondaryButton: "Button", DestructiveButton: "Button",
    IconUtilityButton: Object.entries(imports).find(([path]) => path.endsWith("/ui/Primitives"))?.[1].UiPressable ?? "Pressable",
  };
  if (id.endsWith("/ui/PaperTexture")) return "PaperTexture";
  if (id.endsWith("/GameNotice")) return { __esModule: true, default: "GameNotice", GameNoticeOverlay: "NoticeOverlay" };
  if (id.endsWith("/GameNoticeHost")) return "GameNoticeHost";
  if (id.endsWith("/feedback/notices")) return {
    showGameNotice: (title, message) => imports["react-native"]?.Alert?.alert(title, message),
    setGameFeedbackActive() {},
  };
}
