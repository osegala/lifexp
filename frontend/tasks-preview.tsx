// Isolated DEV review entry, never an app route or an authentication bypass.
import { registerRootComponent } from "expo";
if (__DEV__) registerRootComponent(require("./src/dev/TasksPreview").default);
else throw new Error("The Tasks preview is development-only.");
