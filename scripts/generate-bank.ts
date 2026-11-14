/**
 * Builds lib/sudoku/puzzles.json — a bank of graded puzzles per level.
 * At runtime each puzzle is shuffled with a seeded symmetry transform,
 * so the bank gives practically endless distinct grids.
 *
 *   npm run puzzles
 */
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { geometry, gridToString, SHAPE_6, SHAPE_9, type Geometry } from '../lib/sudoku/geometry.ts';
import { addClues, clueCount, generateMinimal } from '../lib/sudoku/generator.ts';
import { grade } from '../lib/sudoku/grader.ts';
import { createRng, type Rng } from '../lib/sudoku/rng.ts';

const PER_LEVEL = 150;
const rng = createRng(20261114);
const g9 = geometry(SHAPE_9);
const g6 = geometry(SHAPE_6);

function collect(
  name: string,
  make: () => string | null,
  count = PER_LEVEL,
): string[] {
  const out = new Set<string>();
  let tries = 0;
  while (out.size < count) {
    tries++;
    const p = make();
    if (p) out.add(p);
  }
  console.log(`${name.padEnd(10)} ${out.size} puzzles (${tries} tries)`);
  return [...out];
}

const between = (r: Rng, lo: number, hi: number) => lo + r.int(hi - lo + 1);

function singlesWithClues(g: Geometry, lo: number, hi: number, symmetric = true) {
  return () => {
    const gen = generateMinimal(g, rng, symmetric);
    if (grade(gen.puzzle, g).rank !== 1) return null;
    const puzzle = addClues(gen, g, between(rng, lo, hi), rng);
    return gridToString(puzzle);
  };
}

const bank = {
  mini: collect('mini', singlesWithClues(g6, 18, 20)),
  facile: collect('facile', singlesWithClues(g9, 38, 41)),
  moyen: collect('moyen', () => {
    const gen = generateMinimal(g9, rng, true);
    const gr = grade(gen.puzzle, g9);
    // needs real scanning: several hidden singles
    if (gr.rank !== 1 || (gr.counts.hiddenSingle ?? 0) < 12) return null;
    return gridToString(addClues(gen, g9, between(rng, 30, 32), rng));
  }),
  difficile: collect('difficile', () => {
    const gen = generateMinimal(g9, rng, true);
    const gr = grade(gen.puzzle, g9);
    if (gr.rank < 2 || gr.rank > 3) return null;
    return gridToString(gen.puzzle);
  }),
  extreme: (() => {
    // half "advanced logic" (x-wing, swordfish, xy-wing), half beyond
    const pick = (want: (rank: number) => boolean) => () => {
      const gen = generateMinimal(g9, rng, false);
      if (clueCount(gen.puzzle) > 26) return null;
      return want(grade(gen.puzzle, g9).rank) ? gridToString(gen.puzzle) : null;
    };
    const a = collect('extreme/4', pick((r) => r === 4), PER_LEVEL / 2);
    const b = collect('extreme/5', pick((r) => r === 5), PER_LEVEL / 2);
    return rng.shuffle([...a, ...b]);
  })(),
};

const file = fileURLToPath(new URL('../lib/sudoku/puzzles.json', import.meta.url));
writeFileSync(file, JSON.stringify(bank) + '\n');
console.log('wrote', file);
