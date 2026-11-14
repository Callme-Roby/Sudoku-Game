/**
 * Multiplayer rooms: a duel (2) or a battle royale (up to 10).
 * Everyone gets the same seeded grid; the server keeps the clock and checks
 * each player's grid, so times and progress can be trusted.
 *
 * Storage: one JSON key for the room, one hash with a field per player —
 * each player only ever writes their own field, so polls never clobber each other.
 */
import { randomBytes, randomUUID } from 'node:crypto';
import { progress } from '../game/state.ts';
import { geometryFor, isLevel, makePuzzle, type Level } from '../sudoku/bank.ts';
import { isCompleteAndValid } from '../sudoku/solver.ts';
import { pairs, store } from './store.ts';

export type Mode = 'duel' | 'royale';
export const MAX_PLAYERS: Record<Mode, number> = { duel: 2, royale: 10 };

const TTL_S = 6 * 3600;
const ACTIVE_MS = 30_000;
const HEARTBEAT_MS = 5_000;
const COUNTDOWN_MS = 3_500;
const CODE_ALPHABET = 'abcdefghjkmnpqrstuvwxyz23456789';

export interface RoomMeta {
  code: string;
  mode: Mode;
  level: Level;
  seed: number;
  round: number;
  status: 'lobby' | 'playing';
  startAt: number | null;
  hostId: string;
  createdAt: number;
}

interface PlayerRec {
  id: string;
  name: string;
  token: string;
  joinedAt: number;
  seenAt: number;
  round: number;
  progress: number;
  finishedMs: number | null;
  gaveUp: boolean;
}

export interface PublicPlayer {
  id: string;
  name: string;
  active: boolean;
  progress: number;
  finishedMs: number | null;
  gaveUp: boolean;
}

export interface PublicRoom {
  code: string;
  mode: Mode;
  level: Level;
  seed: number;
  round: number;
  status: RoomMeta['status'];
  startAt: number | null;
  hostId: string;
  max: number;
  now: number;
  players: PublicPlayer[];
}

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

const metaKey = (code: string) => `sudoku:room:${code}`;
const playersKey = (code: string) => `sudoku:room:${code}:p`;

export function isMode(x: unknown): x is Mode {
  return x === 'duel' || x === 'royale';
}

export function cleanName(raw: unknown): string {
  const s = typeof raw === 'string' ? raw.replace(/\s+/g, ' ').trim() : '';
  return Array.from(s).slice(0, 16).join('') || 'joueur';
}

export function normalizeCode(raw: string): string | null {
  const c = raw.toLowerCase();
  return /^[a-z2-9]{5}$/.test(c) ? c : null;
}

function newCode(): string {
  const bytes = randomBytes(5);
  return Array.from(bytes, (b) => CODE_ALPHABET[b % CODE_ALPHABET.length]).join('');
}

function newSeed(): number {
  return randomBytes(4).readUInt32LE(0);
}

function newPlayer(name: string, now: number, round: number): PlayerRec {
  return {
    id: randomUUID().slice(0, 8),
    name: cleanName(name),
    token: randomUUID(),
    joinedAt: now,
    seenAt: now,
    round,
    progress: 0,
    finishedMs: null,
    gaveUp: false,
  };
}

async function load(code: string): Promise<{ meta: RoomMeta; players: PlayerRec[] }> {
  const [rawMeta, rawPlayers] = await store().exec([
    ['GET', metaKey(code)],
    ['HGETALL', playersKey(code)],
  ]);
  if (!rawMeta) throw new HttpError(404, 'partie introuvable');
  const meta = (typeof rawMeta === 'string' ? JSON.parse(rawMeta) : rawMeta) as RoomMeta;
  const players = Object.values(pairs(rawPlayers))
    .map((v) => JSON.parse(v) as PlayerRec)
    .sort((a, b) => a.joinedAt - b.joinedAt);
  return { meta, players };
}

const isActive = (p: PlayerRec, now: number) => now - p.seenAt < ACTIVE_MS;

/** The host, or the longest-present active player if the host left. */
function effectiveHost(meta: RoomMeta, players: PlayerRec[], now: number): string {
  const host = players.find((p) => p.id === meta.hostId);
  if (host && isActive(host, now)) return host.id;
  return players.find((p) => isActive(p, now))?.id ?? meta.hostId;
}

function view(meta: RoomMeta, players: PlayerRec[], now: number): PublicRoom {
  return {
    code: meta.code,
    mode: meta.mode,
    level: meta.level,
    seed: meta.seed,
    round: meta.round,
    status: meta.status,
    startAt: meta.startAt,
    hostId: effectiveHost(meta, players, now),
    max: MAX_PLAYERS[meta.mode],
    now,
    players: players.map((p) => {
      const current = p.round === meta.round;
      return {
        id: p.id,
        name: p.name,
        active: isActive(p, now),
        progress: current ? p.progress : 0,
        finishedMs: current ? p.finishedMs : null,
        gaveUp: current ? p.gaveUp : false,
      };
    }),
  };
}

function savePlayer(code: string, p: PlayerRec) {
  return ['HSET', playersKey(code), p.id, JSON.stringify(p)];
}

function saveMeta(meta: RoomMeta) {
  return ['SET', metaKey(meta.code), JSON.stringify(meta), 'EX', TTL_S];
}

function authenticate(players: PlayerRec[], auth: string | null): PlayerRec {
  const [id, token] = (auth ?? '').split(':');
  const me = players.find((p) => p.id === id);
  if (!me || !token || me.token !== token) throw new HttpError(403, 'joueur inconnu');
  return me;
}

export async function createRoom(mode: unknown, level: unknown, name: unknown) {
  if (!isMode(mode) || !isLevel(level)) throw new HttpError(400, 'paramètres invalides');
  const now = Date.now();
  const host = newPlayer(String(name ?? ''), now, 1);
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = newCode();
    const meta: RoomMeta = {
      code,
      mode,
      level,
      seed: newSeed(),
      round: 1,
      status: 'lobby',
      startAt: null,
      hostId: host.id,
      createdAt: now,
    };
    const [ok] = await store().exec([['SET', metaKey(code), JSON.stringify(meta), 'NX', 'EX', TTL_S]]);
    if (ok !== 'OK') continue;
    await store().exec([savePlayer(code, host), ['EXPIRE', playersKey(code), TTL_S]]);
    return { code, id: host.id, token: host.token };
  }
  throw new HttpError(503, 'réessaie dans un instant');
}

export async function getRoom(code: string, auth: string | null): Promise<PublicRoom> {
  const { meta, players } = await load(code);
  const now = Date.now();
  if (auth) {
    try {
      const me = authenticate(players, auth);
      if (now - me.seenAt > HEARTBEAT_MS) {
        me.seenAt = now;
        await store().exec([savePlayer(code, me)]);
      }
    } catch {
      /* spectators and strangers can read the room */
    }
  }
  return view(meta, players, now);
}

export async function joinRoom(code: string, name: unknown) {
  const { meta, players } = await load(code);
  const now = Date.now();
  if (meta.status !== 'lobby') throw new HttpError(409, 'la partie a déjà commencé');
  const present = players.filter((p) => isActive(p, now));
  if (present.length >= MAX_PLAYERS[meta.mode]) throw new HttpError(409, 'la partie est complète');
  const me = newPlayer(String(name ?? ''), now, meta.round);
  await store().exec([savePlayer(code, me), ['EXPIRE', playersKey(code), TTL_S]]);
  return { code, id: me.id, token: me.token };
}

async function launch(meta: RoomMeta, players: PlayerRec[], now: number, newRound: boolean) {
  const gone = players.filter((p) => !isActive(p, now)).map((p) => p.id);
  const next: RoomMeta = {
    ...meta,
    status: 'playing',
    startAt: now + COUNTDOWN_MS,
    round: newRound ? meta.round + 1 : meta.round,
    seed: newRound ? newSeed() : meta.seed,
  };
  const cmds: (string | number)[][] = [saveMeta(next), ['EXPIRE', playersKey(meta.code), TTL_S]];
  if (gone.length) cmds.push(['HDEL', playersKey(meta.code), ...gone]);
  await store().exec(cmds);
  return view(
    next,
    players.filter((p) => !gone.includes(p.id)),
    now,
  );
}

export async function startRoom(code: string, auth: string | null) {
  const { meta, players } = await load(code);
  const now = Date.now();
  const me = authenticate(players, auth);
  if (effectiveHost(meta, players, now) !== me.id) throw new HttpError(403, "seul l'hôte peut lancer");
  if (meta.status !== 'lobby') return view(meta, players, now);
  if (players.filter((p) => isActive(p, now)).length < 2) throw new HttpError(409, 'il faut au moins deux joueurs');
  return launch(meta, players, now, false);
}

export async function rematch(code: string, auth: string | null) {
  const { meta, players } = await load(code);
  const now = Date.now();
  const me = authenticate(players, auth);
  if (effectiveHost(meta, players, now) !== me.id) throw new HttpError(403, "seul l'hôte peut relancer");
  if (meta.status !== 'playing') throw new HttpError(409, 'pas de partie en cours');
  const current = players.filter((p) => isActive(p, now));
  const over = current.every((p) => p.round === meta.round && (p.finishedMs !== null || p.gaveUp));
  if (!over) throw new HttpError(409, 'la manche n’est pas finie');
  return launch(meta, players, now, true);
}

export async function reportProgress(code: string, auth: string | null, body: unknown) {
  const { meta, players } = await load(code);
  const now = Date.now();
  const me = authenticate(players, auth);
  const { round, values, giveUp } = (body ?? {}) as { round?: number; values?: string; giveUp?: boolean };
  if (meta.status !== 'playing' || meta.startAt === null || round !== meta.round) {
    throw new HttpError(409, 'manche terminée');
  }
  if (now < meta.startAt) throw new HttpError(409, 'pas encore');
  if (me.round !== meta.round) {
    me.round = meta.round;
    me.progress = 0;
    me.finishedMs = null;
    me.gaveUp = false;
  }
  me.seenAt = now;
  if (me.finishedMs === null && !me.gaveUp) {
    if (giveUp) {
      me.gaveUp = true;
    } else {
      const puzzle = makePuzzle(meta.level, meta.seed);
      const g = geometryFor(meta.level);
      if (typeof values !== 'string' || values.length !== g.size || !/^[0-9]+$/.test(values)) {
        throw new HttpError(400, 'grille invalide');
      }
      const grid = Array.from(values, Number);
      if (puzzle.givens.some((v, i) => v && grid[i] !== v)) throw new HttpError(400, 'grille invalide');
      me.progress = progress(grid, puzzle.givens, puzzle.solution);
      if (isCompleteAndValid(grid, g)) {
        me.progress = 1;
        me.finishedMs = now - meta.startAt;
      }
    }
  }
  await store().exec([savePlayer(code, me)]);
  return view(
    meta,
    players.map((p) => (p.id === me.id ? me : p)),
    now,
  );
}
