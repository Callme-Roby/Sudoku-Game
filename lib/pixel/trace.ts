/**
 * Orders the pixels of a 1-pixel line drawing as a pen would draw them,
 * then slices that timeline into frames (one SVG path per frame).
 *
 * Each connected stroke is walked breadth-first from its left-most loose end,
 * strokes follow each other from left to right.
 */
import type { Bitmap } from './glyphs.ts';

function runsPath(pixels: number[], w: number): string {
  const byRow = new Map<number, number[]>();
  for (const p of pixels) {
    const y = Math.floor(p / w);
    if (!byRow.has(y)) byRow.set(y, []);
    byRow.get(y)!.push(p % w);
  }
  let d = '';
  for (const [y, xs] of byRow) {
    xs.sort((a, b) => a - b);
    let start = xs[0];
    let prev = xs[0];
    for (let i = 1; i <= xs.length; i++) {
      if (i < xs.length && xs[i] === prev + 1) {
        prev = xs[i];
        continue;
      }
      d += `M${start} ${y}h${prev - start + 1}v1h${start - prev - 1}z`;
      if (i < xs.length) start = prev = xs[i];
    }
  }
  return d;
}

export function strokeFrames(rows: Bitmap, frames = 60): string[] {
  const h = rows.length;
  const w = rows[0].length;
  const on = (x: number, y: number) => x >= 0 && y >= 0 && x < w && y < h && rows[y][x] === '#';
  const neighbours = (p: number) => {
    const x = p % w;
    const y = Math.floor(p / w);
    const out: number[] = [];
    for (let dy = -1; dy <= 1; dy++)
      for (let dx = -1; dx <= 1; dx++) if ((dx || dy) && on(x + dx, y + dy)) out.push((y + dy) * w + x + dx);
    return out;
  };

  // connected strokes, discovered column by column (= sorted by left-most x)
  const seen = new Set<number>();
  const strokes: number[][] = [];
  for (let x = 0; x < w; x++) {
    for (let y = 0; y < h; y++) {
      const p = y * w + x;
      if (!on(x, y) || seen.has(p)) continue;
      const comp: number[] = [];
      const stack = [p];
      seen.add(p);
      while (stack.length) {
        const q = stack.pop()!;
        comp.push(q);
        for (const n of neighbours(q)) if (!seen.has(n)) (seen.add(n), stack.push(n));
      }
      strokes.push(comp);
    }
  }

  const time = new Map<number, number>();
  let offset = 0;
  const PAUSE = 4; // pen lift between strokes
  for (const comp of strokes) {
    // start at the left-most loose end (lowest one on ties), like an entry stroke
    const ends = comp.filter((p) => neighbours(p).length === 1);
    const pool = ends.length ? ends : comp;
    const start = pool.reduce((a, b) => {
      const ax = a % w;
      const bx = b % w;
      return bx < ax || (bx === ax && b > a) ? b : a;
    });
    const depth = new Map<number, number>([[start, 0]]);
    const queue = [start];
    let max = 0;
    for (let i = 0; i < queue.length; i++) {
      const q = queue[i];
      for (const n of neighbours(q)) {
        if (depth.has(n)) continue;
        const dn = depth.get(q)! + 1;
        depth.set(n, dn);
        max = Math.max(max, dn);
        queue.push(n);
      }
    }
    for (const [p, dp] of depth) time.set(p, offset + dp);
    offset += max + PAUSE;
  }

  const total = Math.max(1, offset - PAUSE);
  const buckets: number[][] = Array.from({ length: frames }, () => []);
  for (const [p, t] of time) buckets[Math.round((t / total) * (frames - 1))].push(p);
  return buckets.map((b) => (b.length ? runsPath(b, w) : ''));
}
