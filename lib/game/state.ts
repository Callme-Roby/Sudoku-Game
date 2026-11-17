/** Pure game state + reducer, shared by solo and multiplayer. */
import { bit, type Geometry } from '../sudoku/geometry.ts';
import { isCompleteAndValid } from '../sudoku/solver.ts';

export interface Snapshot {
  values: number[];
  notes: number[];
}

export interface GameState extends Snapshot {
  givens: number[];
  selected: number | null;
  notesMode: boolean;
  history: Snapshot[];
  won: boolean;
  /** digits placed in conflict with another one (same row, column or box) */
  errors: number;
  /** more than MAX_ERRORS errors: the game is over */
  lost: boolean;
}

/** Errors allowed in a game; the next one loses it. */
export const MAX_ERRORS = 3;

export type Action =
  | { type: 'select'; index: number | null }
  | { type: 'move'; dr: number; dc: number }
  | { type: 'input'; digit: number }
  | { type: 'erase' }
  | { type: 'undo' }
  | { type: 'toggleNotes' }
  | { type: 'reset'; state: GameState };

const HISTORY_LIMIT = 200;

export function initialState(
  givens: number[],
  saved?: Partial<Snapshot> & { won?: boolean; errors?: number; lost?: boolean },
): GameState {
  const values = saved?.values?.length === givens.length ? saved.values.slice() : givens.slice();
  // givens always win over saved values
  givens.forEach((v, i) => {
    if (v) values[i] = v;
  });
  const notes = saved?.notes?.length === givens.length ? saved.notes.slice() : new Array(givens.length).fill(0);
  return {
    givens,
    values,
    notes,
    selected: null,
    notesMode: false,
    history: [],
    won: Boolean(saved?.won),
    errors: Math.max(0, Math.floor(Number(saved?.errors) || 0)),
    lost: Boolean(saved?.lost),
  };
}

function withHistory(s: GameState): Snapshot[] {
  const h = [...s.history, { values: s.values, notes: s.notes }];
  return h.length > HISTORY_LIMIT ? h.slice(h.length - HISTORY_LIMIT) : h;
}

export function createReducer(g: Geometry) {
  return function reducer(s: GameState, a: Action): GameState {
    switch (a.type) {
      case 'reset':
        return a.state;
      case 'select':
        return { ...s, selected: a.index };
      case 'move': {
        const cur = s.selected ?? Math.floor(g.size / 2);
        if (s.selected === null) return { ...s, selected: cur };
        const r = (g.rowOf[cur] + a.dr + g.n) % g.n;
        const c = (g.colOf[cur] + a.dc + g.n) % g.n;
        return { ...s, selected: r * g.n + c };
      }
      case 'toggleNotes':
        return { ...s, notesMode: !s.notesMode };
      case 'undo': {
        // undo removes the digit, not the error: the counter never goes down
        if (s.won || s.lost || !s.history.length) return s;
        const prev = s.history[s.history.length - 1];
        return { ...s, ...prev, history: s.history.slice(0, -1) };
      }
      case 'erase': {
        const i = s.selected;
        if (s.won || s.lost || i === null || s.givens[i]) return s;
        if (!s.values[i] && !s.notes[i]) return s;
        const values = s.values.slice();
        const notes = s.notes.slice();
        values[i] = 0;
        notes[i] = 0;
        return { ...s, values, notes, history: withHistory(s) };
      }
      case 'input': {
        const i = s.selected;
        const d = a.digit;
        if (s.won || s.lost || i === null || s.givens[i] || d < 1 || d > g.n) return s;
        if (s.notesMode) {
          if (s.values[i]) return s;
          const notes = s.notes.slice();
          notes[i] ^= bit(d);
          return { ...s, notes, history: withHistory(s) };
        }
        const values = s.values.slice();
        const notes = s.notes.slice();
        if (values[i] === d) {
          values[i] = 0;
        } else {
          values[i] = d;
          notes[i] = 0;
          // a placed digit clears itself from the notes of its row, column and box
          for (const p of g.peers[i]) notes[p] &= ~bit(d);
        }
        const won = isCompleteAndValid(values, g);
        const clash = values[i] === d && g.peers[i].some((p) => values[p] === d);
        const errors = s.errors + (clash ? 1 : 0);
        const lost = !won && errors > MAX_ERRORS;
        return {
          ...s,
          values,
          notes,
          won,
          errors,
          lost,
          selected: won || lost ? null : s.selected,
          history: withHistory(s),
        };
      }
    }
  };
}

/** Cells whose digit appears more than once in one of their units. */
export function conflicts(values: number[], g: Geometry): Set<number> {
  const out = new Set<number>();
  for (const unit of g.units) {
    const seen = new Map<number, number>();
    for (const i of unit) {
      const v = values[i];
      if (!v) continue;
      const j = seen.get(v);
      if (j !== undefined) {
        out.add(i);
        out.add(j);
      } else seen.set(v, i);
    }
  }
  return out;
}

/** How many times each digit is placed (index = digit). */
export function digitCounts(values: number[], n: number): number[] {
  const counts = new Array(n + 1).fill(0);
  for (const v of values) if (v) counts[v]++;
  return counts;
}

/** Share of the empty cells that hold the right digit (0..1). */
export function progress(values: ArrayLike<number>, givens: number[], solution: number[]): number {
  let open = 0;
  let good = 0;
  for (let i = 0; i < givens.length; i++) {
    if (givens[i]) continue;
    open++;
    if (values[i] === solution[i]) good++;
  }
  return open ? good / open : 1;
}
