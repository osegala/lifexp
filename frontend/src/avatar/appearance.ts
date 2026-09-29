export type BodyType = "BOY" | "GIRL";

export type AvatarAppearance = {
  bodyType: BodyType;
  hairId: string;
  skinColorId: string;
  hairColorId: string;
  eyeColorId: string;
};

export type AppearanceColor = {
  id: string;
  name: string;
  color: string;
};

export const HAIR_STYLE_IDS = [
  "avatar-v2/hair/windblown-layers",
  "avatar-v2/hair/side-swept-layers",
  "avatar-v2/hair/spring-curls",
  "avatar-v2/hair/skyward-spikes",
  "avatar-v2/hair/tousled-layers",
  "avatar-v2/hair/curtain-bob",
  "avatar-v2/hair/high-ponytail",
  "avatar-v2/hair/twin-braids",
  "avatar-v2/hair/feathered-sweep",
  "avatar-v2/hair/long-shag",
] as const;

export const SKIN_COLORS: readonly AppearanceColor[] = [
  { id: "skin_01", name: "Porcelain", color: "#E9B396" },
  { id: "skin_02", name: "Ivory", color: "#E4A989" },
  { id: "skin_03", name: "Light Neutral", color: "#DDA07D" },
  { id: "skin_04", name: "Light Warm", color: "#D79773" },
  { id: "skin_05", name: "Peach", color: "#CF8E68" },
  { id: "skin_06", name: "Golden Beige", color: "#C7845D" },
  { id: "skin_07", name: "Warm Beige", color: "#BD7954" },
  { id: "skin_08", name: "Tan", color: "#B16D49" },
  { id: "skin_09", name: "Warm Tan", color: "#A46142" },
  { id: "skin_10", name: "Amber", color: "#96563B" },
  { id: "skin_11", name: "Sienna", color: "#884B35" },
  { id: "skin_12", name: "Chestnut", color: "#79412F" },
  { id: "skin_13", name: "Deep Neutral", color: "#6A372A" },
  { id: "skin_14", name: "Deep Warm", color: "#5C3026" },
  { id: "skin_15", name: "Espresso", color: "#4E2922" },
  { id: "skin_16", name: "Ebony", color: "#41231E" },
];

export const HAIR_COLORS: readonly AppearanceColor[] = [
  { id: "black", name: "Black", color: "#151312" },
  { id: "soft_black", name: "Soft Black", color: "#292523" },
  { id: "dark_brown", name: "Dark Brown", color: "#3C2922" },
  { id: "brown", name: "Brown", color: "#684735" },
  { id: "chestnut", name: "Chestnut", color: "#7D4532" },
  { id: "light_brown", name: "Light Brown", color: "#9B6B4B" },
  { id: "dark_blonde", name: "Dark Blonde", color: "#917B55" },
  { id: "blonde", name: "Blonde", color: "#C9AA68" },
  { id: "platinum", name: "Platinum", color: "#E5DED0" },
  { id: "auburn", name: "Auburn", color: "#82402C" },
  { id: "copper", name: "Copper", color: "#B85F35" },
  { id: "red", name: "Red", color: "#A83431" },
  { id: "silver", name: "Silver", color: "#B8BDC5" },
  { id: "gray", name: "Gray", color: "#73757C" },
  { id: "blue", name: "Blue", color: "#356DB2" },
  { id: "teal", name: "Teal", color: "#278A85" },
  { id: "green", name: "Green", color: "#4F8B4B" },
  { id: "purple", name: "Purple", color: "#7552A3" },
  { id: "pink", name: "Pink", color: "#C65D88" },
  { id: "deep_red", name: "Deep Red", color: "#722B38" },
];

export const EYE_COLORS: readonly AppearanceColor[] = [
  { id: "dark_brown", name: "Dark Brown", color: "#4A3027" },
  { id: "brown", name: "Brown", color: "#76503A" },
  { id: "light_brown", name: "Light Brown", color: "#9B704A" },
  { id: "hazel", name: "Hazel", color: "#7F7740" },
  { id: "amber", name: "Amber", color: "#B47A28" },
  { id: "green", name: "Green", color: "#4F845C" },
  { id: "blue", name: "Blue", color: "#3F72A8" },
  { id: "light_blue", name: "Light Blue", color: "#6EA6C9" },
  { id: "gray", name: "Gray", color: "#777E82" },
  { id: "gray_blue", name: "Gray Blue", color: "#657D91" },
  { id: "violet", name: "Violet", color: "#765B9F" },
  { id: "aqua", name: "Aqua", color: "#3A9B9B" },
];

export const DEFAULT_APPEARANCE: AvatarAppearance = Object.freeze({
  bodyType: "BOY",
  hairId: HAIR_STYLE_IDS[0],
  skinColorId: "skin_04",
  hairColorId: "brown",
  eyeColorId: "brown",
});

const values = {
  bodyType: ["BOY", "GIRL"],
  hairId: HAIR_STYLE_IDS,
  skinColorId: SKIN_COLORS.map(({ id }) => id),
  hairColorId: HAIR_COLORS.map(({ id }) => id),
  eyeColorId: EYE_COLORS.map(({ id }) => id),
} as const;

export function normalizeAppearance(value: Partial<AvatarAppearance> | null | undefined): AvatarAppearance {
  return Object.fromEntries(Object.entries(DEFAULT_APPEARANCE).map(([field, fallback]) => {
    const candidate = value?.[field as keyof AvatarAppearance];
    return [field, (values[field as keyof typeof values] as readonly unknown[]).includes(candidate)
      ? candidate
      : fallback];
  })) as AvatarAppearance;
}

export function appearanceColor(
  palette: readonly AppearanceColor[],
  id: string,
  fallbackId: string,
) {
  return palette.find((option) => option.id === id)?.color
    ?? palette.find((option) => option.id === fallbackId)?.color
    ?? "#FFFFFF";
}

export async function loadOptionalAppearance(
  getAppearance: () => Promise<AvatarAppearance>,
) {
  try {
    return normalizeAppearance(await getAppearance());
  } catch {
    return DEFAULT_APPEARANCE;
  }
}

export async function loadPreferredAppearance(
  getServerAppearance: () => Promise<Partial<AvatarAppearance>>,
  getLocalAppearance: () => Promise<AvatarAppearance>,
  cacheServerAppearance?: (appearance: AvatarAppearance) => Promise<void>,
) {
  try {
    const appearance = normalizeAppearance(await getServerAppearance());
    await cacheServerAppearance?.(appearance);
    return appearance;
  } catch {
    return loadOptionalAppearance(getLocalAppearance);
  }
}
