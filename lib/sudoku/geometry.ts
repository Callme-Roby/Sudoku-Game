/** Board geometry: classic 9×9 (3×3 boxes) and mini 6×6 (2×3 boxes). */

export interface Shape {
  /** side length (number of digits) */
  n: number;
  /** box height in cells */
  br: number;
  /** box width in cells */
  bc: number;
}

export const SHAPE_9: Shape = { n: 9, br: 3, bc: 3 };
export const SHAPE_6: Shape = { n: 6, br: 2, bc: 3 };

export interface Geometry extends Shape {
  size: number;
  /** all bits set for digits 1..n (bit d-1 = digit d) */
  full: number;
  rowOf: Int8Array;
  colOf: Int8Array;
  boxOf: Int8Array;
  /** units: rows, then cols, then boxes; each a list of cell indices */
  units: number[][];
  rows: number[][];
  cols: number[][];
  boxes: number[][];
  /** the three unit indices (row, col, box) for each cell */
  unitsOf: number[][];
  /** the other cells sharing a unit with each cell */
  peers: number[][];
}

const cache = new Map<string, Geometry>();

export function geometry(shape: Shape): Geometry {
  const key = `${shape.n}:${shape.br}:${shape.bc}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const { n, br, bc } = shape;
  const size = n * n;
  const rowOf = new Int8Array(size);
  const colOf = new Int8Array(size);
  const boxOf = new Int8Array(size);
  const rows: number[][] = Array.from({ length: n }, () => []);
  const cols: number[][] = Array.from({ length: n }, () => []);
  const boxes: number[][] = Array.from({ length: n }, () => []);
  const boxesPerRow = n / bc;
  for (let i = 0; i < size; i++) {
    const r = Math.floor(i / n);
    const c = i % n;
    const b = Math.floor(r / br) * boxesPerRow + Math.floor(c / bc);
    rowOf[i] = r;
    colOf[i] = c;
    boxOf[i] = b;
    rows[r].push(i);
    cols[c].push(i);
    boxes[b].push(i);
  }
  const units = [...rows, ...cols, ...boxes];
  const unitsOf: number[][] = [];
  const peers: number[][] = [];
  for (let i = 0; i < size; i++) {
    unitsOf.push([rowOf[i], n + colOf[i], 2 * n + boxOf[i]]);
    const set = new Set<number>([...rows[rowOf[i]], ...cols[colOf[i]], ...boxes[boxOf[i]]]);
    set.delete(i);
    peers.push([...set]);
  }
  const g: Geometry = {
    ...shape,
    size,
    full: (1 << n) - 1,
    rowOf,
    colOf,
    boxOf,
    units,
    rows,
    cols,
    boxes,
    unitsOf,
    peers,
  };
  cache.set(key, g);
  return g;
}

export function popcount(x: number): number {
  let c = 0;
  while (x) {
    x &= x - 1;
    c++;
  }
  return c;
}

/** digit (1-based) of the lowest set bit */
export function lowDigit(mask: number): number {
  return 31 - Math.clz32(mask & -mask) + 1;
}

export function bit(d: number): number {
  return 1 << (d - 1);
}

export function digitsOf(mask: number): number[] {
  const out: number[] = [];
  for (let d = 1; mask; d++, mask >>= 1) if (mask & 1) out.push(d);
  return out;
}

export function parseGrid(s: string): number[] {
  return Array.from(s, (ch) => (ch >= '1' && ch <= '9' ? ch.charCodeAt(0) - 48 : 0));
}

export function gridToString(grid: ArrayLike<number>): string {
  let s = '';
  for (let i = 0; i < grid.length; i++) s += String(grid[i] || 0);
  return s;
}
