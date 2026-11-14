'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '@/lib/game/api';
import { getName, saveName } from '@/lib/game/identity';
import { formatTime, playerId } from '@/lib/game/local';
import type { Board, BoardLine } from '@/lib/server/scores';
import type { Level } from '@/lib/sudoku/bank';
import { gridToString } from '@/lib/sudoku/geometry';

type Phase = 'loading' | 'ask' | 'sending' | 'done' | 'offline';

/**
 * Best times for a level, shown when a solo grid is solved.
 * The first time we ask for a first name; afterwards the time is sent on its own.
 */
export function Leaderboard({
  level,
  run,
  values,
  time,
}: {
  level: Level;
  run: string | null;
  values: number[];
  time: number;
}) {
  const [phase, setPhase] = useState<Phase>('loading');
  const [board, setBoard] = useState<Board | null>(null);
  const [name, setName] = useState('');
  const sent = useRef(false);

  const load = useCallback(async () => {
    try {
      setBoard(await api<Board>(`/api/scores/${level}?p=${playerId()}`));
      return true;
    } catch {
      return false;
    }
  }, [level]);

  const submit = useCallback(
    async (who: string) => {
      if (sent.current || !run) return;
      sent.current = true;
      setPhase('sending');
      const name = saveName(who) ?? who;
      try {
        setBoard(
          await api<Board>('/api/scores', {
            method: 'POST',
            body: { run, player: playerId(), name, values: gridToString(values), time: Math.round(time) },
          }),
        );
        setPhase('done');
      } catch {
        // already sent (reload), expired or refused: still show the board
        setPhase((await load()) ? 'done' : 'offline');
      }
    },
    [run, values, time, load],
  );

  useEffect(() => {
    const saved = getName();
    if (run && saved) {
      setName(saved);
      submit(saved);
      return;
    }
    load().then((ok) => setPhase(!ok ? 'offline' : run ? 'ask' : 'done'));
  }, [run, submit, load]);

  if (phase === 'offline') return null;

  return (
    <div className="scores">
      <span className="muted">meilleurs temps</span>
      {phase === 'ask' && (
        <form
          className="ask"
          onSubmit={(e) => {
            e.preventDefault();
            submit(name);
          }}
        >
          <input
            className="input"
            value={name}
            maxLength={16}
            autoComplete="given-name"
            placeholder="ton prénom"
            aria-label="ton prénom pour le classement"
            onChange={(e) => setName(e.target.value)}
          />
          <button type="submit" className="item">
            ok
          </button>
        </form>
      )}
      {board && <BoardList board={board} />}
      <Link href={`/classement?niveau=${level}`} className="item muted">
        tout le classement
      </Link>
    </div>
  );
}

export function BoardList({ board }: { board: Board }) {
  return (
    <ol className="players">
      {board.top.map((l) => (
        <Line key={l.rank} line={l} />
      ))}
      {board.mine && (
        <>
          <li className="muted empty" aria-hidden>
            <span>…</span>
          </li>
          <Line line={board.mine} />
        </>
      )}
      {board.top.length === 0 && (
        <li className="muted empty">
          <span>aucun temps pour l’instant</span>
        </li>
      )}
    </ol>
  );
}

function Line({ line }: { line: BoardLine }) {
  return (
    <li>
      <span>
        <span className="muted">{line.rank}  </span>
        <span className={line.me ? 'me' : undefined}>{line.name}</span>
      </span>
      <span className="muted">{formatTime(line.time)}</span>
    </li>
  );
}
