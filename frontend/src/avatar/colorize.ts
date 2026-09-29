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

  const shadow: Rgb = [midtone[0] * 0.86, midtone[1] * 0.65, midtone[2] * 0.55];
  const midtonePosition = (SKIN_SOURCE_MIDTONE - SKIN_SOURCE_SHADOW)
    / (SKIN_SOURCE_HIGHLIGHT - SKIN_SOURCE_SHADOW);
  const highlightAt = (index: number) => (
    midtone[index] - (1 - midtonePosition) * shadow[index]
  ) / midtonePosition;
  const highlight: Rgb = [highlightAt(0), highlightAt(1), highlightAt(2)];
  return { shadow, midtone, highlight };
}

/** Maps the authored skin luminance band onto its warm three-tone ramp. */
export function skinTintMatrix(hexColor: string) {
  const { shadow, highlight } = skinToneRamp(hexColor);
  const sourceSpan = SKIN_SOURCE_HIGHLIGHT - SKIN_SOURCE_SHADOW;
  return shadow.flatMap((value, index) => {
    const slope = (highlight[index] - value) / sourceSpan;
    const alphaOffset = value - slope * SKIN_SOURCE_SHADOW;
    return [...LUMINANCE.map((weight) => slope * weight), alphaOffset, 0];
  }).concat([0, 0, 0, 1, 0]);
}

export function avatarTintMatrix(channel: "skin" | "hair" | "eyes", hexColor: string) {
  return channel === "skin" ? skinTintMatrix(hexColor) : grayscaleTintMatrix(hexColor);
}
