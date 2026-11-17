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
import { geometryFor, isLevel, LEVELS, makePuzzle, type Level } from '../sudoku/bank.ts';
import { MAX_ERRORS } from '../game/state.ts';
import { isCompleteAndValid } from '../sudoku/solver.ts';
import { cleanName, HttpError } from './rooms.ts';
import { store } from './store.ts';

const RUN_TTL_S = 7 * 24 * 3600;
const KEEP = 1000; // lines kept per level
const TOP = 5; // default size of the top
const TOP_MAX = 20;
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
  /** errors made in the grid that set this time */
  errors: number;
  me: boolean;
}

/** what the names hash holds per player and level */
interface Entry {
  name: string;
  errors: number;
  at: number;
}

function parseEntry(raw: unknown): Entry {
  try {
    const e = JSON.parse(String(raw)) as Partial<Entry>;
    return {
      name: typeof e.name === 'string' && e.name ? e.name : 'Joueur',
      errors: Math.min(MAX_ERRORS, Math.max(0, Math.floor(Number(e.errors) || 0))),
      at: Number(e.at) || 0,
    };
  } catch {
    return { name: 'Joueur', errors: 0, at: 0 };
  }
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
    throw new HttpError(400, 'Paramètres invalides');
  }
  const run = randomUUID();
  await store().exec([['SET', runKey(run), JSON.stringify({ level, seed, at: Date.now() }), 'EX', RUN_TTL_S]]);
  return { run };
}

export async function getBoard(level: unknown, player: unknown, size: unknown = TOP): Promise<Board> {
  if (!isLevel(level)) throw new HttpError(404, 'Niveau inconnu');
  const me = isPlayerId(player) ? player : null;
  const n = Math.min(TOP_MAX, Math.max(1, Math.floor(Number(size)) || TOP));
  const [rawTop, total, rank, score] = await store().exec([
    ['ZRANGE', boardKey(level), 0, n - 1, 'WITHSCORES'],
    ['ZCARD', boardKey(level)],
    ['ZRANK', boardKey(level), me ?? '-'],
    ['ZSCORE', boardKey(level), me ?? '-'],
  ]);
  // flat [member, score, …] list, already in rank order
  const flat = Array.isArray(rawTop) ? rawTop.map(String) : [];
  const top: { id: string; time: number }[] = [];
  for (let i = 0; i + 1 < flat.length; i += 2) top.push({ id: flat[i], time: Number(flat[i + 1]) });
  const outside = me !== null && rank !== null && Number(rank) >= n;
  const ids = [...top.map((l) => l.id), ...(outside ? [me] : [])];
  const [names] = ids.length ? await store().exec([['HMGET', namesKey(level), ...ids]]) : [[]];
  const entry = (i: number) => parseEntry((names as (string | null)[])[i]);
  return {
    level,
    top: top.map((l, i) => {
      const e = entry(i);
      return { rank: i + 1, name: e.name, time: l.time, errors: e.errors, me: l.id === me };
    }),
    mine:
      outside && score !== null
        ? (() => {
            const e = entry(top.length);
            return { rank: Number(rank) + 1, name: e.name, time: Number(score), errors: e.errors, me: true };
          })()
        : null,
    total: Number(total),
  };
}

export async function submitRun(body: unknown): Promise<Board> {
  const { run, player, name, values, time, errors } = (body ?? {}) as Record<string, unknown>;
  if (typeof run !== 'string' || !/^[0-9a-f-]{36}$/.test(run) || !isPlayerId(player)) {
    throw new HttpError(400, 'Paramètres invalides');
  }
  const [raw] = await store().exec([['GET', runKey(run)]]);
  if (!raw) throw new HttpError(404, 'Partie inconnue');
  const { level, seed, at } = JSON.parse(String(raw)) as { level: Level; seed: number; at: number };
  const g = geometryFor(level);
  const puzzle = makePuzzle(level, seed);

  if (typeof values !== 'string' || values.length !== g.size || !/^[1-9]+$/.test(values)) {
    throw new HttpError(400, 'Grille invalide');
  }
  const grid = Array.from(values, Number);
  if (puzzle.givens.some((v, i) => v && grid[i] !== v) || !isCompleteAndValid(grid, g)) {
    throw new HttpError(400, 'Grille invalide');
  }
  const empty = puzzle.givens.filter((v) => !v).length;
  const elapsed = Date.now() - at;
  if (typeof time !== 'number' || !Number.isFinite(time) || time < empty * MIN_MS_PER_CELL || time > elapsed + SLACK_MS) {
    throw new HttpError(400, 'Temps invalide');
  }

  const mistakes = Number(errors ?? 0);
  if (!Number.isInteger(mistakes) || mistakes < 0 || mistakes > MAX_ERRORS) {
    throw new HttpError(400, 'Erreurs invalides');
  }

  // the errors shown are those of the grid that set the best time
  const [prevScore, prevRaw] = await store().exec([
    ['ZSCORE', boardKey(level), player],
    ['HGET', namesKey(level), player],
  ]);
  const improved = prevScore === null || Math.round(time) < Number(prevScore);
  const entry: Entry = {
    name: cleanName(name),
    errors: improved ? mistakes : parseEntry(prevRaw).errors,
    at: Date.now(),
  };
  await store().exec([
    ['ZADD', boardKey(level), 'LT', Math.round(time), player],
    ['HSET', namesKey(level), player, JSON.stringify(entry)],
    ['ZREMRANGEBYRANK', boardKey(level), KEEP, -1],
    ['DEL', runKey(run)], // one submission per grid
  ]);
  return getBoard(level, player);
}

/** New first name: shown on every board where this player already has a time. */
export async function renamePlayer(body: unknown) {
  const { player, name } = (body ?? {}) as Record<string, unknown>;
  if (!isPlayerId(player)) throw new HttpError(400, 'Paramètres invalides');
  const clean = cleanName(name);
  const found = await store().exec(
    LEVELS.flatMap((level) => [
      ['ZSCORE', boardKey(level), player],
      ['HGET', namesKey(level), player],
    ]),
  );
  // keep each line's errors, only the name changes
  const cmds = LEVELS.flatMap((level, i) =>
    found[2 * i] === null
      ? []
      : [['HSET', namesKey(level), player, JSON.stringify({ ...parseEntry(found[2 * i + 1]), name: clean })]],
  );
  if (cmds.length) await store().exec(cmds);
  return { name: clean, boards: cmds.length };
}
