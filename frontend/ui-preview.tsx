// Standalone component review, not an app route or an auth/data-flow bypass.
import { registerRootComponent } from "expo";

if (__DEV__) {
  registerRootComponent(require("./src/dev/UiPreview").default);
} else {
  throw new Error("The UI preview is development-only.");
}
