/** Coordinates remain the server's hidden grid; the landscape does not decide progress or combat. */
import type { XY } from '@/types/saga';

export const EXPLORE_CELL = 2.4;
export const RIVER_CELL = 3.6;
export const WALKABLE = '.,=_:+';
export function worldCell(at: XY, width: number, height: number, cell: number): XY {
  return [(at[0] + 0.5 - width / 2) * cell, (at[1] + 0.5 - height / 2) * cell];
}
export function gridCell(x: number, z: number, width: number, height: number, cell: number): XY {
  return [Math.floor(x / cell + width / 2), Math.floor(z / cell + height / 2)];
}
export function walkGrid(grid: string[], occupied: XY[]): boolean[][] {
  const blocked = grid.map(row => [...row].map(ch => !WALKABLE.includes(ch)));
  for (const [x, y] of occupied) if (blocked[y]?.[x] !== undefined) blocked[y][x] = true;
  return blocked;
}
export function isFree(blocked: boolean[][], x: number, y: number): boolean {
  return blocked[y]?.[x] === false;
}
export function routeTo(blocked: boolean[][], start: XY, end: XY, adjacent = false): XY[] {
  const goal = (x: number, y: number): boolean => adjacent
    ? Math.max(Math.abs(x - end[0]), Math.abs(y - end[1])) <= 1 && isFree(blocked, x, y)
    : x === end[0] && y === end[1];
  if (goal(...start)) return [];
  const key = (x: number, y: number): string => `${x},${y}`;
  const prev = new Map<string, string | null>([[key(...start), null]]);
  const queue: XY[] = [start];
  for (let i = 0; i < queue.length; i++) {
    const [cx, cy] = queue[i];
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const x = cx + dx, y = cy + dy, k = key(x, y);
      if (prev.has(k) || !isFree(blocked, x, y)) continue;
      prev.set(k, key(cx, cy));
      if (goal(x, y)) {
        const path: XY[] = [];
        for (let at: string | null = k; at && prev.get(at) !== null; at = prev.get(at) ?? null) path.unshift(at.split(',').map(Number) as XY);
        return path;
      }
      queue.push([x, y]);
    }
  }
  return [];
}
export function formationOffsets(mounted: boolean, elephant: boolean): XY[] {
  if (elephant) return [[0, 0]];
  const rows = mounted ? 2 : 3, cols = 3, space = mounted ? 1.6 : 0.8;
  return Array.from({ length: rows * cols }, (_, i) => [(i % cols - 1) * space, (Math.floor(i / cols) - (rows - 1) / 2) * space]);
}
