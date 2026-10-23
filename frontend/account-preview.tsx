import { registerRootComponent } from "expo";
if (__DEV__) {
  registerRootComponent(require("./src/dev/AccountPreview").default);
} else {
  throw new Error("The account UI preview is development-only.");
}
