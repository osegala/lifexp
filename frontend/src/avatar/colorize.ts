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

/** Colorizes neutral skin art between a warm shadow and the selected complexion. */
export function skinTintMatrix(hexColor: string) {
  const hex = hexColor.replace("#", "");
  const target = [0, 2, 4].map((offset) => Number.parseInt(hex.slice(offset, offset + 2), 16) / 255);
  if (target.some(Number.isNaN)) throw new Error(`Invalid palette color: ${hexColor}`);

  const [red, green, blue] = target;
  const shadow = [
    Math.min(red, red * 0.18 + 0.018),
    green * 0.1,
    blue * 0.055,
  ];
  const luminance = [0.2126, 0.7152, 0.0722];
  return target.flatMap((value, index) => [
    ...luminance.map((weight) => (value - shadow[index]) * weight),
    0,
    shadow[index],
  ]).concat([0, 0, 0, 1, 0]);
}

export function avatarTintMatrix(channel: "skin" | "hair" | "eyes", hexColor: string) {
  return channel === "skin" ? skinTintMatrix(hexColor) : grayscaleTintMatrix(hexColor);
}
