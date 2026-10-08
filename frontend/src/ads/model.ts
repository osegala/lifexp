export type AdMode = "disabled" | "placeholder" | "test" | "live";
export type BannerPlacement = "HOME" | "SHOP";

/** Live inventory requires an explicit production opt-in AND complete platform configuration. */
export function resolveAdMode(value: string | undefined, appEnvironment: string, developmentBuild: boolean,
  native = false, liveEnabled = false, configured = false): AdMode {
  if (developmentBuild && appEnvironment === "dev") {
    if (value === "placeholder") return "placeholder";
    if (value === "test" && native) return "test";
  }
  return value === "live" && appEnvironment === "prod" && !developmentBuild && native && liveEnabled && configured ? "live" : "disabled";
}

export function routeAllowsBanner(placement: BannerPlacement, pathname: string) {
  const route = placement === "HOME" ? "dashboard" : placement === "SHOP" ? "shop" : null;
  return route !== null && [ `/${route}`, `/(tabs)/${route}` ].includes(pathname);
}
