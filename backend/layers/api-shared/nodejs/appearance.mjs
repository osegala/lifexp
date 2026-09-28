export const BODY_TYPES = Object.freeze(["BOY", "GIRL"]);

export const HAIR_IDS = Object.freeze([
    "avatar-v2/hair/windblown-layers",
    "avatar-v2/hair/side-swept-layers",
    "avatar-v2/hair/spring-curls",
    "avatar-v2/hair/skyward-spikes",
    "avatar-v2/hair/tousled-layers",
    "avatar-v2/hair/curtain-bob",
    "avatar-v2/hair/high-ponytail",
    "avatar-v2/hair/twin-braids",
    "avatar-v2/hair/feathered-sweep",
    "avatar-v2/hair/long-shag"
]);

export const SKIN_COLOR_IDS = Object.freeze(
    Array.from({ length: 16 }, (_, index) => `skin_${String(index + 1).padStart(2, "0")}`)
);

export const HAIR_COLOR_IDS = Object.freeze([
    "black", "soft_black", "dark_brown", "brown", "chestnut",
    "light_brown", "dark_blonde", "blonde", "platinum", "auburn",
    "copper", "red", "silver", "gray", "blue", "teal", "green",
    "purple", "pink", "deep_red"
]);

export const EYE_COLOR_IDS = Object.freeze([
    "dark_brown", "brown", "light_brown", "hazel", "amber", "green",
    "blue", "light_blue", "gray", "gray_blue", "violet", "aqua"
]);

export const DEFAULT_APPEARANCE = Object.freeze({
    bodyType: "BOY",
    hairId: "avatar-v2/hair/windblown-layers",
    skinColorId: "skin_04",
    hairColorId: "brown",
    eyeColorId: "brown"
});

export const APPEARANCE_VALUES = Object.freeze({
    bodyType: BODY_TYPES,
    hairId: HAIR_IDS,
    skinColorId: SKIN_COLOR_IDS,
    hairColorId: HAIR_COLOR_IDS,
    eyeColorId: EYE_COLOR_IDS
});

export function normalizeAppearance(profile = {}) {
    return Object.fromEntries(Object.entries(DEFAULT_APPEARANCE).map(([field, fallback]) => {
        const value = profile[field]?.S ?? profile[field];
        return [field, APPEARANCE_VALUES[field].includes(value) ? value : fallback];
    }));
}
