import { describe, expect, it } from 'vitest';
import bank from '../lib/sudoku/puzzles.json';
import { geometryFor, isLevel, LEVELS, makePuzzle } from '../lib/sudoku/bank.ts';
import { geometry, parseGrid, SHAPE_6, SHAPE_9 } from '../lib/sudoku/geometry.ts';
import { grade } from '../lib/sudoku/grader.ts';
import { hasUniqueSolution, isCompleteAndValid, solve } from '../lib/sudoku/solver.ts';
import { conflicts, createReducer, initialState, progress } from '../lib/game/state.ts';

const g9 = geometry(SHAPE_9);
const g6 = geometry(SHAPE_6);

describe('geometry', () => {
  it('builds 9×9 and 6×6 units', () => {
    expect(g9.units).toHaveLength(27);
    expect(g9.peers[0]).toHaveLength(20);
    expect(g6.units).toHaveLength(18);
    // 6×6 boxes are 2 rows × 3 columns
    expect(g6.boxes[0]).toEqual([0, 1, 2, 6, 7, 8]);
    expect(g6.peers[0]).toHaveLength(12);
  });
});

describe('solver & grader', () => {
  const classic = parseGrid(
    '530070000600195000098000060800060003400803001700020006060000280000419005000080079',
  );
  it('solves a classic puzzle uniquely', () => {
    const r = solve(classic, g9);
    expect(r.count).toBe(1);
    expect(isCompleteAndValid(r.solution!, g9)).toBe(true);
  });
  it('grades an easy puzzle as singles', () => {
    expect(grade(classic, g9)).toMatchObject({ solved: true, rank: 1 });
  });
  it('detects multiple solutions', () => {
    expect(hasUniqueSolution(new Array(81).fill(0), g9)).toBe(false);
  });
});

describe('bank', () => {
  it('has unique, correctly graded puzzles for every level', () => {
    const data = bank as Record<string, string[]>;
    for (const level of LEVELS) {
      const g = geometryFor(level);
      expect(data[level].length).toBeGreaterThanOrEqual(100);
      for (const s of data[level].slice(0, 25)) {
        const p = parseGrid(s);
        expect(p).toHaveLength(g.size);
        expect(hasUniqueSolution(p, g)).toBe(true);
        const r = grade(p, g).rank;
        if (level === 'facile' || level === 'moyen' || level === 'mini') expect(r).toBe(1);
        if (level === 'difficile') expect(r === 2 || r === 3).toBe(true);
        if (level === 'extreme') expect(r).toBeGreaterThanOrEqual(4);
      }
    }
  });

  it('makes the same grid from the same seed, and a valid one', () => {
    for (const level of LEVELS) {
      const a = makePuzzle(level, 12345);
      const b = makePuzzle(level, 12345);
      expect(a.givens).toEqual(b.givens);
      const g = geometryFor(level);
      expect(isCompleteAndValid(a.solution, g)).toBe(true);
      a.givens.forEach((v, i) => v && expect(a.solution[i]).toBe(v));
      expect(hasUniqueSolution(a.givens, g)).toBe(true);
      // transformation keeps difficulty
      const r = grade(a.givens, g).rank;
      if (level === 'extreme') expect(r).toBeGreaterThanOrEqual(4);
      else if (level === 'difficile') expect(r === 2 || r === 3).toBe(true);
      else expect(r).toBe(1);
    }
    expect(makePuzzle('moyen', 1).givens).not.toEqual(makePuzzle('moyen', 2).givens);
  });

  it('validates level names', () => {
    expect(isLevel('extreme')).toBe(true);
    expect(isLevel('nope')).toBe(false);
  });
});

describe('game reducer', () => {
  const p = makePuzzle('mini', 7);
  const g = geometryFor('mini');
  const reduce = createReducer(g);

  it('places digits, clears notes in peers and undoes', () => {
    let s = initialState(p.givens);
    const empty = p.givens.findIndex((v) => !v);
    const peer = g.peers[empty].find((i) => !p.givens[i])!;
    s = reduce(s, { type: 'select', index: peer });
    s = reduce(s, { type: 'toggleNotes' });
    s = reduce(s, { type: 'input', digit: p.solution[empty] });
    expect(s.notes[peer]).not.toBe(0);
    s = reduce(s, { type: 'toggleNotes' });
    s = reduce(s, { type: 'select', index: empty });
    s = reduce(s, { type: 'input', digit: p.solution[empty] });
    expect(s.values[empty]).toBe(p.solution[empty]);
    expect(s.notes[peer]).toBe(0);
    s = reduce(s, { type: 'undo' });
    expect(s.values[empty]).toBe(0);
  });

  it('never edits givens and detects the win', () => {
    let s = initialState(p.givens);
    const given = p.givens.findIndex((v) => v);
    s = reduce(s, { type: 'select', index: given });
    s = reduce(s, { type: 'erase' });
    expect(s.values[given]).toBe(p.givens[given]);
    p.givens.forEach((v, i) => {
      if (v) return;
      s = reduce(s, { type: 'select', index: i });
      s = reduce(s, { type: 'input', digit: p.solution[i] });
    });
    expect(s.won).toBe(true);
    expect(progress(s.values, p.givens, p.solution)).toBe(1);
  });

  it('counts digits placed in conflict, and loses on the 4th', () => {
    let s = initialState(p.givens);
    const given = p.givens.findIndex((v) => v);
    // empty peers of that given: placing its digit there is a conflict
    const targets = g.peers[given].filter((i) => !p.givens[i]);
    const clash = p.givens[given];
    s = reduce(s, { type: 'select', index: targets[0] });
    s = reduce(s, { type: 'input', digit: clash });
    expect(s.errors).toBe(1);
    // taking the digit back (same key, or undo) does not refund the error
    s = reduce(s, { type: 'input', digit: clash });
    expect(s.values[targets[0]]).toBe(0);
    expect(s.errors).toBe(1);
    // notes never count
    s = reduce(s, { type: 'toggleNotes' });
    s = reduce(s, { type: 'input', digit: clash });
    s = reduce(s, { type: 'toggleNotes' });
    expect(s.errors).toBe(1);
    for (let k = 0; k < 3; k++) {
      s = reduce(s, { type: 'select', index: targets[k % targets.length] });
      s = reduce(s, { type: 'erase' });
      s = reduce(s, { type: 'input', digit: clash });
      s = reduce(s, { type: 'undo' });
    }
    expect(s.errors).toBe(4);
    expect(s.lost).toBe(true);
    expect(s.selected).toBeNull();
    // the game is over: nothing changes any more
    const frozen = reduce(reduce(s, { type: 'select', index: targets[1] }), { type: 'input', digit: 1 });
    expect(frozen.values).toEqual(s.values);
  });

  it('a correct digit is never an error', () => {
    let s = initialState(p.givens);
    p.givens.forEach((v, i) => {
      if (v) return;
      s = reduce(s, { type: 'select', index: i });
      s = reduce(s, { type: 'input', digit: p.solution[i] });
    });
    expect(s).toMatchObject({ won: true, errors: 0, lost: false });
  });

  it('flags conflicts', () => {
    const values = new Array(81).fill(0);
    values[0] = 5;
    values[8] = 5;
    expect([...conflicts(values, g9)].sort()).toEqual([0, 8]);
  });
});
