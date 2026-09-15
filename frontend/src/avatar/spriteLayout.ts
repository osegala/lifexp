/** Pixel coordinates in the source artwork or the shared character canvas. */
export type ImageRect = { x: number; y: number; width: number; height: number };

export type ImageCrop = ImageRect & {
  sourceWidth: number;
  sourceHeight: number;
};

export type SpriteFrame = {
  crop: ImageCrop;
  destination: ImageRect;
  /** Optional silhouette in original-image coordinates (e.g. excludes a glow). */
  sourceClipPath?: string;
  /** Horizontal lean about the sole; keeps the ground line horizontal. */
  shearX?: number;
};

export function sourceFrameTransform(frame: SpriteFrame) {
  const { crop, destination } = frame;
  const sx = destination.width / crop.width;
  const sy = destination.height / crop.height;
  return `matrix(${sx} 0 0 ${sy} ${destination.x - crop.x * sx} ${destination.y - crop.y * sy})`;
}

export type BootCuff = { x: number; y: number; width: number };
export type TrouserLeg = { x: number; width: number };

export function trouserTuckSlices(cuffs: readonly BootCuff[], legs: readonly TrouserLeg[]) {
  if (cuffs.length !== 2 || legs.length !== 2) return undefined;
  const startY = Math.min(...cuffs.map(cuff => cuff.y)) - 90;
  const slices = cuffs.flatMap(cuff => {
    const leg = legs.find(item => (item.x < 627) === (cuff.x < 627))!;
    const endY = cuff.y + 24;
    const sourceHalf = { x: cuff.x < 627 ? 0 : 627, y: 0, width: 627, height: 1254 };
    const result = [];
    // Small horizontal bands preserve the painted trouser outline while the
    // fabric narrows into the cuff. The original PNG is reused, never altered.
    for (let y = startY; y < endY; y += 2) {
      const progress = Math.min(1, (y + 1 - startY) / (cuff.y - startY));
      const eased = progress * progress * (3 - 2 * progress);
      const scaleX = 1 + (Math.min(1, (cuff.width - 12) / leg.width) - 1) * eased;
      const translateX = (cuff.x - leg.x) * eased + leg.x * (1 - scaleX);
      result.push({
        clip: { x: 0, y, width: 1254, height: Math.min(2, endY - y) + 0.25 },
        sourceHalf, scaleX, translateX,
      });
    }
    return result;
  });
  return { startY, slices };
}

export function spriteImageRect(frame?: SpriteFrame): ImageRect {
  if (!frame) return { x: 0, y: 0, width: 1254, height: 1254 };
  const { crop, destination: d } = frame;
  const sx = d.width / crop.width;
  const sy = d.height / crop.height;
  return {
    x: d.x - crop.x * sx, y: d.y - crop.y * sy,
    width: crop.sourceWidth * sx, height: crop.sourceHeight * sy,
  };
}

export function spriteTransform(frame?: SpriteFrame) {
  if (!frame?.shearX) return undefined;
  const ground = frame.destination.y + frame.destination.height;
  return `matrix(1 0 ${frame.shearX} 1 ${-frame.shearX * ground} 0)`;
}

/** Keep the knees, taper into each opening, and discard everything inside the shaft. */
export function trouserTuckPath(cuffs: readonly BootCuff[]): string | undefined {
  if (!cuffs.length) return undefined;
  const startY = Math.min(...cuffs.map(cuff => cuff.y)) - 70;
  return [
    `M0 0H1254V${startY}H0Z`,
    ...cuffs.map(({ x, y, width }) => {
      const half = width / 2 - 6;
      return `M${x - 115} ${startY}H${x + 115}` +
        `C${x + 95} ${y - 36} ${x + half} ${y - 16} ${x + half} ${y + 12}` +
        `V${y + 24}H${x - half}V${y + 12}` +
        `C${x - half} ${y - 16} ${x - 95} ${y - 36} ${x - 115} ${startY}Z`;
    }),
  ].join(" ");
}

export const percent = (value: number): `${number}%` => `${value * 100}%`;

/** Position the original image behind a clipped viewport without editing it. */
export function croppedImageStyle(crop: ImageCrop) {
  return {
    left: percent(-crop.x / crop.width),
    top: percent(-crop.y / crop.height),
    width: percent(crop.sourceWidth / crop.width),
    height: percent(crop.sourceHeight / crop.height),
  };
}
