/**
 * Levels and seeded puzzles. A seed picks a puzzle from the graded bank and
 * shuffles it (digits, rows within bands, bands, columns, stacks, transpose):
 * difficulty is preserved and every player of a room gets the same grid.
 */
import { geometry, parseGrid, SHAPE_6, SHAPE_9, type Geometry } from './geometry.ts';
import bank from './puzzles.json' with { type: 'json' };
import { createRng } from './rng.ts';
import { solve } from './solver.ts';

export const LEVELS = ['facile', 'moyen', 'difficile', 'extreme', 'mini'] as const;
export type Level = (typeof LEVELS)[number];

export const LEVEL_LABEL: Record<Level, string> = {
  facile: 'Facile',
  moyen: 'Moyen',
  difficile: 'Difficile',
  extreme: 'Extrême',
  mini: '6 × 6',
};

export function isLevel(x: unknown): x is Level {
  return typeof x === 'string' && (LEVELS as readonly string[]).includes(x);
}

export function geometryFor(level: Level): Geometry {
  return geometry(level === 'mini' ? SHAPE_6 : SHAPE_9);
}

export interface Puzzle {
  level: Level;
  seed: number;
  givens: number[];
  solution: number[];
}

function shuffledGroups(rng: ReturnType<typeof createRng>, groups: number, per: number): number[] {
  const order: number[] = [];
  for (const gIdx of rng.shuffle(Array.from({ length: groups }, (_, i) => i))) {
    for (const k of rng.shuffle(Array.from({ length: per }, (_, i) => i))) order.push(gIdx * per + k);
  }
  return order;
}

const memo = new Map<string, Puzzle>();

export function makePuzzle(level: Level, seed: number): Puzzle {
  const key = `${level}:${seed}`;
  const hit = memo.get(key);
  if (hit) return hit;
  const g = geometryFor(level);
  const { n, br, bc } = g;
  const list = (bank as Record<Level, string[]>)[level];
  const rng = createRng(seed);
  const base = parseGrid(list[rng.int(list.length)]);
  const digits = rng.shuffle(Array.from({ length: n }, (_, i) => i + 1));
  const rows = shuffledGroups(rng, n / br, br);
  const cols = shuffledGroups(rng, n / bc, bc);
  const transpose = br === bc && rng.next() < 0.5;
  const givens = new Array<number>(n * n);
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      const [sr, sc] = transpose ? [cols[c], rows[r]] : [rows[r], cols[c]];
      const v = base[sr * n + sc];
      givens[r * n + c] = v ? digits[v - 1] : 0;
    }
  }
  const { solution } = solve(givens, g, 1);
  if (!solution) throw new Error('unsolvable puzzle in bank');
  const puzzle = { level, seed, givens, solution };
  if (memo.size > 200) memo.clear();
  memo.set(key, puzzle);
  return puzzle;
}
