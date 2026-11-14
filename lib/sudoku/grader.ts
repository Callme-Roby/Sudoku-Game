/**
 * Human-style logical solver used to grade puzzles.
 * A puzzle's rank is the hardest technique needed to solve it:
 *   1 singles · 2 locked candidates, naked pairs · 3 hidden pairs, triples
 *   4 x-wing, swordfish, xy-wing · 5 needs more than that
 */
import { bit, type Geometry, lowDigit, popcount } from './geometry.ts';

export type Technique =
  | 'nakedSingle'
  | 'hiddenSingle'
  | 'lockedCandidates'
  | 'nakedPair'
  | 'hiddenPair'
  | 'nakedTriple'
  | 'hiddenTriple'
  | 'xWing'
  | 'xyWing'
  | 'swordfish';

export interface Grade {
  solved: boolean;
  rank: number;
  counts: Partial<Record<Technique, number>>;
  /** sum of step ranks — finer measure inside a rank */
  score: number;
}

interface State {
  g: Geometry;
  values: number[];
  cand: Int32Array;
}

function place(s: State, i: number, d: number) {
  s.values[i] = d;
  s.cand[i] = 0;
  const b = ~bit(d);
  for (const p of s.g.peers[i]) s.cand[p] &= b;
}

function nakedSingle(s: State): boolean {
  for (let i = 0; i < s.g.size; i++) {
    if (!s.values[i] && popcount(s.cand[i]) === 1) {
      place(s, i, lowDigit(s.cand[i]));
      return true;
    }
  }
  return false;
}

function hiddenSingle(s: State): boolean {
  const { g } = s;
  // boxes first: that is how people usually scan
  const order = [...g.boxes, ...g.rows, ...g.cols];
  for (const unit of order) {
    for (let d = 1; d <= g.n; d++) {
      const b = bit(d);
      let found = -1;
      let many = false;
      for (const i of unit) {
        if (s.cand[i] & b) {
          if (found >= 0) {
            many = true;
            break;
          }
          found = i;
        }
      }
      if (!many && found >= 0) {
        place(s, found, d);
        return true;
      }
    }
  }
  return false;
}

function eliminate(s: State, cells: Iterable<number>, mask: number): boolean {
  let changed = false;
  for (const i of cells) {
    if (s.cand[i] & mask) {
      s.cand[i] &= ~mask;
      changed = true;
    }
  }
  return changed;
}

function lockedCandidates(s: State): boolean {
  const { g } = s;
  // pointing: candidates of a box confined to one row / column
  for (let bx = 0; bx < g.n; bx++) {
    const box = g.boxes[bx];
    for (let d = 1; d <= g.n; d++) {
      const b = bit(d);
      const cells = box.filter((i) => s.cand[i] & b);
      if (cells.length < 2) continue;
      const r = g.rowOf[cells[0]];
      if (cells.every((i) => g.rowOf[i] === r)) {
        if (eliminate(s, g.rows[r].filter((i) => g.boxOf[i] !== bx), b)) return true;
      }
      const c = g.colOf[cells[0]];
      if (cells.every((i) => g.colOf[i] === c)) {
        if (eliminate(s, g.cols[c].filter((i) => g.boxOf[i] !== bx), b)) return true;
      }
    }
  }
  // claiming: candidates of a row / column confined to one box
  const lines = [...g.rows, ...g.cols];
  for (const line of lines) {
    for (let d = 1; d <= g.n; d++) {
      const b = bit(d);
      const cells = line.filter((i) => s.cand[i] & b);
      if (cells.length < 2) continue;
      const bx = g.boxOf[cells[0]];
      if (cells.every((i) => g.boxOf[i] === bx)) {
        const inLine = new Set(line);
        if (eliminate(s, g.boxes[bx].filter((i) => !inLine.has(i)), b)) return true;
      }
    }
  }
  return false;
}

function combinations<T>(arr: T[], k: number): T[][] {
  const out: T[][] = [];
  const pick = (start: number, acc: T[]) => {
    if (acc.length === k) {
      out.push(acc.slice());
      return;
    }
    for (let i = start; i < arr.length; i++) {
      acc.push(arr[i]);
      pick(i + 1, acc);
      acc.pop();
    }
  };
  pick(0, []);
  return out;
}

function nakedSubset(s: State, k: number): boolean {
  for (const unit of s.g.units) {
    const open = unit.filter((i) => !s.values[i]);
    if (open.length <= k) continue;
    const small = open.filter((i) => {
      const c = popcount(s.cand[i]);
      return c >= 2 && c <= k;
    });
    for (const combo of combinations(small, k)) {
      let mask = 0;
      for (const i of combo) mask |= s.cand[i];
      if (popcount(mask) !== k) continue;
      const others = open.filter((i) => !combo.includes(i));
      if (eliminate(s, others, mask)) return true;
    }
  }
  return false;
}

function hiddenSubset(s: State, k: number): boolean {
  const { g } = s;
  for (const unit of g.units) {
    const open = unit.filter((i) => !s.values[i]);
    if (open.length <= k) continue;
    const digits: number[] = [];
    const where = new Map<number, number[]>();
    for (let d = 1; d <= g.n; d++) {
      const cells = open.filter((i) => s.cand[i] & bit(d));
      if (cells.length >= 2 && cells.length <= k) {
        digits.push(d);
        where.set(d, cells);
      }
    }
    for (const combo of combinations(digits, k)) {
      const cells = new Set<number>();
      for (const d of combo) for (const i of where.get(d)!) cells.add(i);
      if (cells.size !== k) continue;
      let keep = 0;
      for (const d of combo) keep |= bit(d);
      let changed = false;
      for (const i of cells) {
        if (s.cand[i] & ~keep) {
          s.cand[i] &= keep;
          changed = true;
        }
      }
      if (changed) return true;
    }
  }
  return false;
}

function fish(s: State, k: number): boolean {
  const { g } = s;
  for (const [base, cover, posOf] of [
    [g.rows, g.cols, (i: number) => g.colOf[i]],
    [g.cols, g.rows, (i: number) => g.rowOf[i]],
  ] as const) {
    for (let d = 1; d <= g.n; d++) {
      const b = bit(d);
      const lines: { idx: number; pos: number }[] = [];
      base.forEach((line, idx) => {
        let pos = 0;
        let count = 0;
        for (const i of line) {
          if (s.cand[i] & b) {
            pos |= 1 << posOf(i);
            count++;
          }
        }
        if (count >= 2 && count <= k) lines.push({ idx, pos });
      });
      for (const combo of combinations(lines, k)) {
        let pos = 0;
        for (const l of combo) pos |= l.pos;
        if (popcount(pos) !== k) continue;
        const baseIdx = new Set(combo.map((l) => l.idx));
        const targets: number[] = [];
        for (let p = 0; p < g.n; p++) {
          if (!(pos & (1 << p))) continue;
          for (const i of cover[p]) {
            const lineIdx = base === g.rows ? g.rowOf[i] : g.colOf[i];
            if (!baseIdx.has(lineIdx)) targets.push(i);
          }
        }
        if (eliminate(s, targets, b)) return true;
      }
    }
  }
  return false;
}

function xyWing(s: State): boolean {
  const { g } = s;
  const isPeer = (a: number, b: number) =>
    g.rowOf[a] === g.rowOf[b] || g.colOf[a] === g.colOf[b] || g.boxOf[a] === g.boxOf[b];
  for (let pivot = 0; pivot < g.size; pivot++) {
    const pm = s.cand[pivot];
    if (popcount(pm) !== 2) continue;
    const wings = g.peers[pivot].filter((i) => {
      const m = s.cand[i];
      return popcount(m) === 2 && popcount(m & pm) === 1;
    });
    for (let a = 0; a < wings.length; a++) {
      for (let c = a + 1; c < wings.length; c++) {
        const A = wings[a];
        const B = wings[c];
        const ma = s.cand[A];
        const mb = s.cand[B];
        const za = ma & ~pm;
        const zb = mb & ~pm;
        if (za !== zb || (ma & pm) === (mb & pm)) continue;
        const targets = g.peers[A].filter((i) => i !== B && i !== pivot && isPeer(i, B));
        if (eliminate(s, targets, za)) return true;
      }
    }
  }
  return false;
}

const TECHNIQUES: [Technique, number, (s: State) => boolean][] = [
  ['nakedSingle', 1, nakedSingle],
  ['hiddenSingle', 1, hiddenSingle],
  ['lockedCandidates', 2, lockedCandidates],
  ['nakedPair', 2, (s) => nakedSubset(s, 2)],
  ['hiddenPair', 3, (s) => hiddenSubset(s, 2)],
  ['nakedTriple', 3, (s) => nakedSubset(s, 3)],
  ['hiddenTriple', 3, (s) => hiddenSubset(s, 3)],
  ['xWing', 4, (s) => fish(s, 2)],
  ['xyWing', 4, xyWing],
  ['swordfish', 4, (s) => fish(s, 3)],
];

export function grade(grid: ArrayLike<number>, g: Geometry): Grade {
  const values = Array.from(grid);
  const cand = new Int32Array(g.size);
  for (let i = 0; i < g.size; i++) {
    if (values[i]) continue;
    let used = 0;
    for (const p of g.peers[i]) if (values[p]) used |= bit(values[p]);
    cand[i] = g.full & ~used;
  }
  const s: State = { g, values, cand };
  const counts: Grade['counts'] = {};
  let rank = 0;
  let score = 0;
  for (;;) {
    let progressed = false;
    for (const [name, r, fn] of TECHNIQUES) {
      if (fn(s)) {
        counts[name] = (counts[name] ?? 0) + 1;
        rank = Math.max(rank, r);
        score += r;
        progressed = true;
        break;
      }
    }
    if (!progressed) break;
  }
  const solved = values.every((v) => v > 0);
  return { solved, rank: solved ? Math.max(rank, 1) : 5, counts, score };
}
