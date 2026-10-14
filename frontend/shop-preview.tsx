// Isolated DEV presentation review; never an application route.
import { registerRootComponent } from "expo";
if (__DEV__) registerRootComponent(require("./src/dev/ShopPreview").default);
else throw new Error("The Shop preview is development-only.");
