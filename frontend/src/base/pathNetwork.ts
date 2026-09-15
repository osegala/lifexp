export type GridCell = { u: number; v: number };
export type PathTile = GridCell & { mask: number };

const DIRECTIONS = [
  { du: 0, dv: -1, bit: 1 },
  { du: 1, dv: 0, bit: 2 },
  { du: 0, dv: 1, bit: 4 },
  { du: -1, dv: 0, bit: 8 },
] as const;

export function cellKey(cell: GridCell) {
  return `${cell.u}:${cell.v}`;
}

function manhattan(a: GridCell, b: GridCell) {
  return Math.abs(a.u - b.u) + Math.abs(a.v - b.v);
}

function reconstruct(cameFrom: Map<string, GridCell>, end: GridCell) {
  const result = [end];
  let cursor = end;
  while (cameFrom.has(cellKey(cursor))) {
    cursor = cameFrom.get(cellKey(cursor))!;
    result.push(cursor);
  }
  return result.reverse();
}

/** A* with a reuse discount, so later buildings naturally join existing roads. */
function findRoute(
  start: GridCell,
  goal: GridCell,
  blocked: Set<string>,
  existing: Set<string>,
) {
  const open = [start];
  const cameFrom = new Map<string, GridCell>();
  const cost = new Map([[cellKey(start), 0]]);
  const visited = new Set<string>();

  while (open.length) {
    open.sort((a, b) =>
      (cost.get(cellKey(a)) ?? Infinity) + manhattan(a, goal) -
      ((cost.get(cellKey(b)) ?? Infinity) + manhattan(b, goal)),
    );
    const current = open.shift()!;
    const currentKey = cellKey(current);
    if (visited.has(currentKey)) continue;
    visited.add(currentKey);
    if (currentKey === cellKey(goal)) return reconstruct(cameFrom, current);

    for (const direction of DIRECTIONS) {
      const next = { u: current.u + direction.du, v: current.v + direction.dv };
      const nextKey = cellKey(next);
      if (blocked.has(nextKey) || Math.abs(next.u) > 15 || Math.abs(next.v) > 15) continue;
      const nextCost = (cost.get(currentKey) ?? 0) + (existing.has(nextKey) ? 0.28 : 1);
      if (nextCost >= (cost.get(nextKey) ?? Infinity)) continue;
      cost.set(nextKey, nextCost);
      cameFrom.set(nextKey, current);
      open.push(next);
    }
  }
  return [start];
}

function closestEntrance(building: GridCell, goal: GridCell, blocked: Set<string>) {
  return DIRECTIONS.map(({ du, dv }) => ({ u: building.u + du, v: building.v + dv }))
    .filter((cell) => !blocked.has(cellKey(cell)))
    .sort((a, b) => manhattan(a, goal) - manhattan(b, goal))[0];
}

export function buildPathNetwork(buildings: GridCell[], goal: GridCell = { u: 0, v: 0 }): PathTile[] {
  const blocked = new Set(buildings.map(cellKey));
  blocked.delete(cellKey(goal));
  const network = new Map<string, GridCell>();
  network.set(cellKey(goal), goal);

  [...buildings]
    .sort((a, b) => manhattan(a, goal) - manhattan(b, goal))
    .forEach((building) => {
      const start = closestEntrance(building, goal, blocked);
      if (!start) return;
      findRoute(start, goal, blocked, new Set(network.keys())).forEach((cell) =>
        network.set(cellKey(cell), cell),
      );
    });

  return [...network.values()].map((cell) => {
    const mask = DIRECTIONS.reduce((value, direction) => {
      const neighbor = cellKey({ u: cell.u + direction.du, v: cell.v + direction.dv });
      return network.has(neighbor) ? value | direction.bit : value;
    }, 0);
    return { ...cell, mask };
  });
}

