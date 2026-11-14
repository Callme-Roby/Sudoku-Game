/** Puzzle generation: random full grid, then dig holes while the solution stays unique. */
import type { Geometry } from './geometry.ts';
import type { Rng } from './rng.ts';
import { hasUniqueSolution, randomFullGrid } from './solver.ts';

export interface Generated {
  puzzle: number[];
  solution: number[];
}

/** Minimal puzzle (no clue can be removed without losing uniqueness). */
export function generateMinimal(g: Geometry, rng: Rng, symmetric = true): Generated {
  const solution = randomFullGrid(g, rng);
  const puzzle = solution.slice();
  const cells = Array.from({ length: g.size }, (_, i) => i).filter(
    (i) => !symmetric || i <= g.size - 1 - i,
  );
  rng.shuffle(cells);
  for (const i of cells) {
    const j = g.size - 1 - i;
    const vi = puzzle[i];
    const vj = puzzle[j];
    puzzle[i] = 0;
    if (symmetric) puzzle[j] = 0;
    if (!hasUniqueSolution(puzzle, g)) {
      puzzle[i] = vi;
      puzzle[j] = vj;
    }
  }
  return { puzzle, solution };
}

export function clueCount(puzzle: ArrayLike<number>): number {
  let c = 0;
  for (let i = 0; i < puzzle.length; i++) if (puzzle[i]) c++;
  return c;
}

/** Give back clues (symmetrically when possible) until `target` clues are shown. */
export function addClues(gen: Generated, g: Geometry, target: number, rng: Rng): number[] {
  const puzzle = gen.puzzle.slice();
  const empty = rng.shuffle(
    Array.from({ length: g.size }, (_, i) => i).filter((i) => !puzzle[i] && i <= g.size - 1 - i),
  );
  for (const i of empty) {
    if (clueCount(puzzle) >= target) break;
    const j = g.size - 1 - i;
    puzzle[i] = gen.solution[i];
    if (clueCount(puzzle) < target) puzzle[j] = gen.solution[j];
  }
  return puzzle;
}
