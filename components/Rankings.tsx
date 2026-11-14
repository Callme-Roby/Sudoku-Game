'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { api } from '@/lib/game/api';
import { getName, saveName } from '@/lib/game/identity';
import { playerId, readJSON, SOLO_KEY, type SavedSolo } from '@/lib/game/local';
import { ICONS } from '@/lib/pixel/glyphs';
import type { Board } from '@/lib/server/scores';
import { isLevel, LEVEL_LABEL, LEVELS, type Level } from '@/lib/sudoku/bank';
import { BoardList } from './Leaderboard';
import { Pixel } from './Pixel';

/** /classement — the top 10 of each level, plus the player's own line and name. */
export function Rankings() {
  const [level, setLevel] = useState<Level | null>(null);
  const [board, setBoard] = useState<Board | null>(null);
  const [status, setStatus] = useState<'loading' | 'ok' | 'offline'>('loading');

  // level: ?niveau=…, else the last level played, else facile
  useEffect(() => {
    const q = new URLSearchParams(window.location.search).get('niveau');
    const last = readJSON<SavedSolo>(SOLO_KEY)?.level;
    setLevel(isLevel(q) ? q : isLevel(last) ? last : 'facile');
  }, []);

  useEffect(() => {
    if (!level) return;
    const url = new URL(window.location.href);
    url.searchParams.set('niveau', level);
    window.history.replaceState(null, '', url);
    let live = true;
    setStatus('loading');
    api<Board>(`/api/scores/${level}?p=${playerId()}&n=10`)
      .then((b) => {
        if (!live) return;
        setBoard(b);
        setStatus('ok');
      })
      .catch(() => live && setStatus('offline'));
    return () => {
      live = false;
    };
  }, [level]);

  return (
    <main className="screen">
      <header className="bar">
        <Link href="/" className="icon-btn" aria-label="menu" style={{ justifySelf: 'start' }}>
          <Pixel rows={ICONS.back} />
        </Link>
        <span>classement</span>
        <span />
      </header>
      <div className="rankings">
        <div className="tabs" role="tablist" aria-label="niveau">
          {LEVELS.map((l) => (
            <button
              key={l}
              type="button"
              role="tab"
              className="item"
              aria-selected={l === level}
              aria-pressed={l === level}
              onClick={() => setLevel(l)}
            >
              {LEVEL_LABEL[l]}
            </button>
          ))}
        </div>
        <div className="scores">
          {status === 'offline' ? (
            <span className="muted">classement indisponible</span>
          ) : board && board.level === level ? (
            <BoardList board={board} />
          ) : (
            <span className="muted">…</span>
          )}
          {level && (
            <Link href={`/solo/${level}`} className="item">
              jouer en {LEVEL_LABEL[level]}
            </Link>
          )}
        </div>
        <NameLine />
      </div>
    </main>
  );
}

/** "tu joues en tant que Léa · changer" */
function NameLine() {
  const [name, setName] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState('');
  useEffect(() => setName(getName()), []);

  if (editing) {
    return (
      <form
        className="ask"
        onSubmit={(e) => {
          e.preventDefault();
          setName(saveName(value));
          setEditing(false);
        }}
      >
        <input
          className="input"
          value={value}
          maxLength={16}
          autoFocus
          autoComplete="given-name"
          aria-label="ton prénom"
          onChange={(e) => setValue(e.target.value)}
        />
        <button type="submit" className="item">
          ok
        </button>
      </form>
    );
  }
  return (
    <p className="muted name-line">
      {name ? (
        <>
          tu joues en tant que <span className="ink">{name}</span> ·{' '}
        </>
      ) : null}
      <button
        type="button"
        className="link-btn"
        onClick={() => {
          setValue(name ?? '');
          setEditing(true);
        }}
      >
        {name ? 'changer' : 'choisir un prénom'}
      </button>
    </p>
  );
}
