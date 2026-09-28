/** Maps neutral grayscale RGB to the selected hue while preserving luminance and alpha. */
export function grayscaleTintMatrix(hexColor: string) {
  const hex = hexColor.replace("#", "");
  const channels = [0, 2, 4].map((offset) => Number.parseInt(hex.slice(offset, offset + 2), 16) / 255);
  if (channels.some(Number.isNaN)) throw new Error(`Invalid palette color: ${hexColor}`);
  const [red, green, blue] = channels;
  return [
    red, 0, 0, 0, 0,
    0, green, 0, 0, 0,
    0, 0, blue, 0, 0,
    0, 0, 0, 1, 0,
  ];
}
