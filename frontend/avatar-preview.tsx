// Isolated DEV shell review, not a route or account/authentication bypass.
import { registerRootComponent } from "expo";
if (__DEV__) registerRootComponent(require("./src/dev/AvatarPreview").default);
else throw new Error("The Avatar preview is development-only.");
