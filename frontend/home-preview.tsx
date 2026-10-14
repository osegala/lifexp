// Isolated DEV presentation review; not an app route or an authentication bypass.
import { registerRootComponent } from "expo";
if (__DEV__) registerRootComponent(require("./src/dev/HomePreview").default);
else throw new Error("The Home preview is development-only.");
