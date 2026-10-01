/** Maps neutral grayscale RGB to the selected hue while preserving luminance and alpha. */
export function grayscaleTintMatrix(hexColor: string, shadowLift = 0) {
  const hex = hexColor.replace("#", "");
  const channels = [0, 2, 4].map((offset) => Number.parseInt(hex.slice(offset, offset + 2), 16) / 255);
  if (channels.some(Number.isNaN)) throw new Error(`Invalid palette color: ${hexColor}`);
  const [red, green, blue] = channels;
  const channel = (value: number) => [value * (1 - shadowLift), value * shadowLift] as const;
  const [redScale, redFloor] = channel(red);
  const [greenScale, greenFloor] = channel(green);
  const [blueScale, blueFloor] = channel(blue);
  return [
    redScale, 0, 0, 0, redFloor,
    0, greenScale, 0, 0, greenFloor,
    0, 0, blueScale, 0, blueFloor,
    0, 0, 0, 1, 0,
  ];
}

type Rgb = readonly [number, number, number];

const SKIN_SOURCE_SHADOW = 0.6;
const SKIN_SOURCE_MIDTONE = 0.78;
const SKIN_SOURCE_HIGHLIGHT = 0.9;
const LUMINANCE: Rgb = [0.2126, 0.7152, 0.0722];

export type SkinToneRamp = Readonly<{
  shadow: Rgb;
  midtone: Rgb;
  highlight: Rgb;
}>;

/** Builds the painted shadow/midtone/highlight ramp used only by neutral skin art. */
export function skinToneRamp(hexColor: string): SkinToneRamp {
  const hex = hexColor.replace("#", "");
  const channel = (offset: number) => Number.parseInt(hex.slice(offset, offset + 2), 16) / 255;
  const midtone: Rgb = [channel(0), channel(2), channel(4)];
  if (midtone.some(Number.isNaN)) throw new Error(`Invalid palette color: ${hexColor}`);

  const at = (sourceLuminance: number): Rgb => {
    const scale = sourceLuminance / SKIN_SOURCE_MIDTONE;
    return [
      Math.min(1, midtone[0] * scale),
      Math.min(1, midtone[1] * scale),
      Math.min(1, midtone[2] * scale),
    ];
  };
  const shadow = at(SKIN_SOURCE_SHADOW);
  const highlight = at(SKIN_SOURCE_HIGHLIGHT);
  return { shadow, midtone, highlight };
}

/** Keeps every neutral skin shade on the selected warm hue, including alpha edges. */
export function skinTintMatrix(hexColor: string, colorSpace: "sRGB" | "linearRGB" = "sRGB") {
  const { midtone } = skinToneRamp(hexColor);
  // iOS Core Image and web SVG filters work in linear RGB; Android uses sRGB.
  // Calibrate both the selected swatch and the source gray in that working space.
  const workingValue = (value: number) => colorSpace === "sRGB" ? value
    : value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  return midtone.flatMap((value) => [
    ...LUMINANCE.map((weight) => weight * workingValue(value) / workingValue(SKIN_SOURCE_MIDTONE)), 0, 0,
  ]).concat([0, 0, 0, 1, 0]);
}

export function avatarTintMatrix(
  channel: "skin" | "hair" | "eyes",
  hexColor: string,
  colorSpace: "sRGB" | "linearRGB" = "sRGB",
) {
  return channel === "skin" ? skinTintMatrix(hexColor, colorSpace) : grayscaleTintMatrix(hexColor);
}
