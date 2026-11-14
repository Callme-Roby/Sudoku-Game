/**
 * Solo leaderboards: one per level, one line per player (their best time).
 *
 * Trust model (no accounts):
 *  - a game starts with `startRun`, which stores the server time for that grid;
 *  - `submitRun` only accepts a solved grid for that exact level + seed, and a
 *    time that is neither longer than the real elapsed time (the client clock
 *    pauses, it never runs ahead) nor faster than humanly possible.
 *
 * Redis: sorted set `sudoku:lb:{level}` (member = player id, score = best ms)
 * and hash `sudoku:lb:{level}:n` (player id → display name).
 */
import { randomUUID } from 'node:crypto';
import { geometryFor, isLevel, makePuzzle, type Level } from '../sudoku/bank.ts';
import { isCompleteAndValid } from '../sudoku/solver.ts';
import { cleanName, HttpError } from './rooms.ts';
import { store } from './store.ts';

const RUN_TTL_S = 7 * 24 * 3600;
const KEEP = 1000; // lines kept per level
const TOP = 5;
const SLACK_MS = 3000;
/** nobody fills a cell in less than this on average */
const MIN_MS_PER_CELL = 500;

const runKey = (id: string) => `sudoku:run:${id}`;
const boardKey = (level: Level) => `sudoku:lb:${level}`;
const namesKey = (level: Level) => `sudoku:lb:${level}:n`;

export interface BoardLine {
  rank: number;
  name: string;
  time: number;
  me: boolean;
}

export interface Board {
  level: Level;
  top: BoardLine[];
  /** the player's own line when it is not in the top */
  mine: BoardLine | null;
  total: number;
}

const isPlayerId = (x: unknown): x is string => typeof x === 'string' && /^[a-z0-9-]{8,40}$/.test(x);

export async function startRun(level: unknown, seed: unknown) {
  if (!isLevel(level) || typeof seed !== 'number' || !Number.isInteger(seed) || seed < 0 || seed >= 2 ** 32) {
    throw new HttpError(400, 'paramètres invalides');
  }
  const run = randomUUID();
  await store().exec([['SET', runKey(run), JSON.stringify({ level, seed, at: Date.now() }), 'EX', RUN_TTL_S]]);
  return { run };
}

export async function getBoard(level: unknown, player: unknown): Promise<Board> {
  if (!isLevel(level)) throw new HttpError(404, 'niveau inconnu');
  const me = isPlayerId(player) ? player : null;
  const [rawTop, total, rank, score] = await store().exec([
    ['ZRANGE', boardKey(level), 0, TOP - 1, 'WITHSCORES'],
    ['ZCARD', boardKey(level)],
    ['ZRANK', boardKey(level), me ?? '-'],
    ['ZSCORE', boardKey(level), me ?? '-'],
  ]);
  // flat [member, score, …] list, already in rank order
  const flat = Array.isArray(rawTop) ? rawTop.map(String) : [];
  const top: { id: string; time: number }[] = [];
  for (let i = 0; i + 1 < flat.length; i += 2) top.push({ id: flat[i], time: Number(flat[i + 1]) });
  const ids = [...top.map((l) => l.id), ...(me && rank !== null && Number(rank) >= TOP ? [me] : [])];
  const [names] = ids.length ? await store().exec([['HMGET', namesKey(level), ...ids]]) : [[]];
  const nameOf = (i: number) => {
    const raw = (names as (string | null)[])[i];
    try {
      return raw ? (JSON.parse(raw) as { name: string }).name : 'joueur';
    } catch {
      return 'joueur';
    }
  };
  return {
    level,
    top: top.map((l, i) => ({ rank: i + 1, name: nameOf(i), time: l.time, me: l.id === me })),
    mine:
      me && rank !== null && Number(rank) >= TOP && score !== null
        ? { rank: Number(rank) + 1, name: nameOf(top.length), time: Number(score), me: true }
        : null,
    total: Number(total),
  };
}

export async function submitRun(body: unknown): Promise<Board> {
  const { run, player, name, values, time } = (body ?? {}) as Record<string, unknown>;
  if (typeof run !== 'string' || !/^[0-9a-f-]{36}$/.test(run) || !isPlayerId(player)) {
    throw new HttpError(400, 'paramètres invalides');
  }
  const [raw] = await store().exec([['GET', runKey(run)]]);
  if (!raw) throw new HttpError(404, 'partie inconnue');
  const { level, seed, at } = JSON.parse(String(raw)) as { level: Level; seed: number; at: number };
  const g = geometryFor(level);
  const puzzle = makePuzzle(level, seed);

  if (typeof values !== 'string' || values.length !== g.size || !/^[1-9]+$/.test(values)) {
    throw new HttpError(400, 'grille invalide');
  }
  const grid = Array.from(values, Number);
  if (puzzle.givens.some((v, i) => v && grid[i] !== v) || !isCompleteAndValid(grid, g)) {
    throw new HttpError(400, 'grille invalide');
  }
  const empty = puzzle.givens.filter((v) => !v).length;
  const elapsed = Date.now() - at;
  if (typeof time !== 'number' || !Number.isFinite(time) || time < empty * MIN_MS_PER_CELL || time > elapsed + SLACK_MS) {
    throw new HttpError(400, 'temps invalide');
  }

  await store().exec([
    ['ZADD', boardKey(level), 'LT', Math.round(time), player],
    ['HSET', namesKey(level), player, JSON.stringify({ name: cleanName(name), at: Date.now() })],
    ['ZREMRANGEBYRANK', boardKey(level), KEEP, -1],
    ['DEL', runKey(run)], // one submission per grid
  ]);
  return getBoard(level, player);
}
