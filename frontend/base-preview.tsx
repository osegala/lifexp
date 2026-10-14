import { registerRootComponent } from "expo";

if (__DEV__) registerRootComponent(require("./src/dev/BasePreview").default);
