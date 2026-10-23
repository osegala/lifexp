type Size = { width: number; height: number; density: number; caps: readonly number[] };

/** Fixed corner sizes in points; only center/edge strips stretch. If a surface
 * becomes smaller than its corners, all corners shrink by the same factor. */
export function nineSliceRegions(width: number, height: number, material: Size) {
  if (width <= 0 || height <= 0) return [];
  const [left, top, right, bottom] = material.caps;
  const scale = Math.min(1, width * material.density / (left + right), height * material.density / (top + bottom)) / material.density;
  const sourceX = [0, left, material.width - right, material.width];
  const sourceY = [0, top, material.height - bottom, material.height];
  const targetX = [0, left * scale, width - right * scale, width];
  const targetY = [0, top * scale, height - bottom * scale, height];
  return Array.from({ length: 9 }, (_, index) => {
    const x = index % 3, y = Math.floor(index / 3);
    return { sx: sourceX[x], sy: sourceY[y], sw: sourceX[x + 1] - sourceX[x], sh: sourceY[y + 1] - sourceY[y],
      x: targetX[x], y: targetY[y], width: targetX[x + 1] - targetX[x], height: targetY[y + 1] - targetY[y] };
  }).filter(region => region.width > 0 && region.height > 0);
}
