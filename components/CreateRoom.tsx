'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { api } from '@/lib/game/api';
import { getName, saveName } from '@/lib/game/identity';
import { roomKey, writeJSON, type RoomCreds } from '@/lib/game/local';
import { ICONS } from '@/lib/pixel/glyphs';
import { LEVEL_LABEL, LEVELS, type Level } from '@/lib/sudoku/bank';
import type { Mode } from '@/lib/server/rooms';
import { Pixel } from './Pixel';

export const MODE_LABEL: Record<Mode, string> = { duel: 'Défier un ami', royale: 'Battle royale' };
const MODE_HINT: Record<Mode, string> = {
  duel: 'Un contre un · même grille · le plus rapide gagne',
  royale: 'Jusqu’à 10 · même grille · le plus rapide gagne',
};

export function CreateRoom({ mode }: { mode: Mode }) {
  const router = useRouter();
  const [name, setName] = useState('');
  const [busy, setBusy] = useState<Level | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => setName((n) => n || (getName() ?? '')), []);

  const create = async (level: Level) => {
    setBusy(level);
    setError(null);
    const who = saveName(name) ?? '';
    try {
      const r = await api<RoomCreds & { code: string }>('/api/rooms', {
        method: 'POST',
        body: { mode, level, name: who },
      });
      writeJSON(roomKey(r.code), { id: r.id, token: r.token } satisfies RoomCreds);
      router.push(`/r/${r.code}`);
    } catch (e) {
      setError((e as Error).message);
      setBusy(null);
    }
  };

  return (
    <main className="screen">
      <header className="bar">
        <Link href="/" className="icon-btn" aria-label="menu" style={{ justifySelf: 'start' }}>
          <Pixel rows={ICONS.back} />
        </Link>
        <span>{MODE_LABEL[mode]}</span>
        <span />
      </header>
      <div className="lobby">
        <label className="field">
          <span className="muted">Ton nom</span>
          <input
            className="input"
            value={name}
            maxLength={16}
            autoComplete="nickname"
            placeholder="Joueur"
            onChange={(e) => setName(e.target.value)}
          />
        </label>
        <div className="field">
          <span className="muted">Grille</span>
          <div className="menu">
            {LEVELS.map((level) => (
              <button
                key={level}
                type="button"
                className="item"
                disabled={busy !== null}
                aria-pressed={busy === level}
                onClick={() => create(level)}
              >
                {LEVEL_LABEL[level]}
              </button>
            ))}
          </div>
        </div>
        <p className="muted" style={{ margin: 0, textAlign: 'center' }}>
          {error ?? MODE_HINT[mode]}
        </p>
      </div>
    </main>
  );
}
