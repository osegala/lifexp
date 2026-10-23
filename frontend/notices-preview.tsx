import { registerRootComponent } from "expo";
if (__DEV__) registerRootComponent(require("./src/dev/NoticePreview").default);
else throw new Error("Feedback review is development-only.");
