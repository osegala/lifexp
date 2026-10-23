/** Keep a visible character even on a short phone or with larger text. */
export function wardrobeTrayStops(availableHeight: number, fontScale = 1) {
  const collapsed = Math.min(availableHeight * 0.5, 108 + Math.max(0, fontScale - 1) * 36);
  const sceneMinimum = availableHeight < 300 ? 96 : 136;
  const expanded = Math.max(collapsed, Math.min(availableHeight * 0.67, availableHeight - sceneMinimum));
  return [collapsed, Math.max(collapsed, Math.min(expanded, availableHeight * 0.4)), expanded];
}

export function nearestTrayStop(height: number, stops: number[]) {
  return stops.reduce((best, value, index) => Math.abs(value - height) < Math.abs(stops[best] - height) ? index : best, 0);
}
