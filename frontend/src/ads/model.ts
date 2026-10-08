export type AdMode = "disabled" | "placeholder";
export type BannerPlacement = "HOME" | "SHOP";

/** There is intentionally no live mode; placeholders also require a development build. */
export function resolveAdMode(value: string | undefined, appEnvironment: string, developmentBuild: boolean): AdMode {
  return developmentBuild && appEnvironment === "dev" && value === "placeholder" ? "placeholder" : "disabled";
}

export function routeAllowsBanner(placement: BannerPlacement, pathname: string) {
  const route = placement === "HOME" ? "dashboard" : placement === "SHOP" ? "shop" : null;
  return route !== null && [ `/${route}`, `/(tabs)/${route}` ].includes(pathname);
}
