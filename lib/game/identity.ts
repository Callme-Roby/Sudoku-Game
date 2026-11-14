/**
 * The player's first name: asked once, kept on this device (localStorage),
 * used for the leaderboards and pre-filled for online games.
 */
import { api } from './api.ts';
import { NAME_KEY, playerId, readJSON, writeJSON } from './local.ts';

export function cleanLocalName(raw: string): string {
  return Array.from(raw.replace(/\s+/g, ' ').trim()).slice(0, 16).join('');
}

export function getName(): string | null {
  const n = readJSON<string>(NAME_KEY);
  return typeof n === 'string' && n.trim() ? n : null;
}

/** Saves the name (an empty field keeps the current one); renames the player's board lines. */
export function saveName(raw: string): string | null {
  const name = cleanLocalName(raw);
  const prev = getName();
  if (!name) return prev;
  writeJSON(NAME_KEY, name);
  if (prev !== name) {
    api('/api/scores/name', { method: 'POST', body: { player: playerId(), name } }).catch(() => {
      /* offline: the next solved grid updates the name anyway */
    });
  }
  return name;
}
