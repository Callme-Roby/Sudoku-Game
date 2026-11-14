/** Fast bitmask backtracking solver, used for uniqueness checks and solutions. */
import { bit, type Geometry, lowDigit, popcount } from './geometry.ts';
import type { Rng } from './rng.ts';

export interface SolveResult {
  /** number of solutions found, capped at `limit` */
  count: number;
  /** first solution found */
  solution: number[] | null;
}

export function solve(grid: ArrayLike<number>, g: Geometry, limit = 2, rng?: Rng): SolveResult {
  const { n, size, full, rowOf, colOf, boxOf } = g;
  const cells = Array.from(grid);
  const rowM = new Int32Array(n);
  const colM = new Int32Array(n);
  const boxM = new Int32Array(n);
  for (let i = 0; i < size; i++) {
    const v = cells[i];
    if (!v) continue;
    const b = bit(v);
    if (rowM[rowOf[i]] & b || colM[colOf[i]] & b || boxM[boxOf[i]] & b) {
      return { count: 0, solution: null };
    }
    rowM[rowOf[i]] |= b;
    colM[colOf[i]] |= b;
    boxM[boxOf[i]] |= b;
  }

  let count = 0;
  let solution: number[] | null = null;

  const search = (): boolean => {
    // choose the empty cell with the fewest candidates
    let best = -1;
    let bestMask = 0;
    let bestCount = 99;
    for (let i = 0; i < size; i++) {
      if (cells[i]) continue;
      const mask = full & ~(rowM[rowOf[i]] | colM[colOf[i]] | boxM[boxOf[i]]);
      const c = popcount(mask);
      if (c < bestCount) {
        best = i;
        bestMask = mask;
        bestCount = c;
        if (c <= 1) break;
      }
    }
    if (best < 0) {
      count++;
      if (!solution) solution = cells.slice();
      return count >= limit;
    }
    if (bestCount === 0) return false;
    let digits: number[] = [];
    for (let m = bestMask; m; m &= m - 1) digits.push(lowDigit(m));
    if (rng) digits = rng.shuffle(digits);
    const r = rowOf[best];
    const c = colOf[best];
    const bx = boxOf[best];
    for (const d of digits) {
      const b = bit(d);
      cells[best] = d;
      rowM[r] |= b;
      colM[c] |= b;
      boxM[bx] |= b;
      if (search()) return true;
      rowM[r] &= ~b;
      colM[c] &= ~b;
      boxM[bx] &= ~b;
    }
    cells[best] = 0;
    return false;
  };

  search();
  return { count, solution };
}

export function hasUniqueSolution(grid: ArrayLike<number>, g: Geometry): boolean {
  return solve(grid, g, 2).count === 1;
}

/** Random complete valid grid. */
export function randomFullGrid(g: Geometry, rng: Rng): number[] {
  const res = solve(new Array(g.size).fill(0), g, 1, rng);
  if (!res.solution) throw new Error('could not build a grid');
  return res.solution;
}

/** True when `values` is a complete grid that respects every rule. */
export function isCompleteAndValid(values: ArrayLike<number>, g: Geometry): boolean {
  for (const unit of g.units) {
    let seen = 0;
    for (const i of unit) {
      const v = values[i];
      if (!v || v > g.n) return false;
      seen |= bit(v);
    }
    if (seen !== g.full) return false;
  }
  return true;
}
