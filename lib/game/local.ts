/** Small helpers around localStorage and time display (client only). */
import type { Level } from '../sudoku/bank.ts';

export function formatTime(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const mm = String(m).padStart(2, '0');
  const ss = String(s).padStart(2, '0');
  return h ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

export function readJSON<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

export function writeJSON(key: string, value: unknown) {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* private mode, quota… the game still works */
  }
}

export interface SavedSolo {
  level: Level;
  seed: number;
  values: number[];
  notes: number[];
  elapsed: number;
  won: boolean;
  errors?: number;
  lost?: boolean;
  /** leaderboard run id from /api/scores/start */
  run?: string | null;
}

export const SOLO_KEY = 'sudoku:solo';
export const NAME_KEY = 'sudoku:nom';
export const bestKey = (level: Level) => `sudoku:record:${level}`;
export const roomKey = (code: string) => `sudoku:salle:${code}`;

export interface RoomCreds {
  id: string;
  token: string;
}

const ID_KEY = 'sudoku:id';

/** Anonymous id of this device's player, for the leaderboards. */
export function playerId(): string {
  let id = readJSON<string>(ID_KEY);
  if (!id || !/^[a-z0-9-]{8,40}$/.test(id)) {
    id =
      typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : Array.from({ length: 24 }, () => Math.floor(Math.random() * 36).toString(36)).join('');
    writeJSON(ID_KEY, id);
  }
  return id;
}
