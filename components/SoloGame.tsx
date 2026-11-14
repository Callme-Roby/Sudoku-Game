'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { bestKey, formatTime, readJSON, SOLO_KEY, writeJSON, type SavedSolo } from '@/lib/game/local';
import { api } from '@/lib/game/api';
import { ICONS } from '@/lib/pixel/glyphs';
import { geometryFor, LEVEL_LABEL, makePuzzle, type Level } from '@/lib/sudoku/bank';
import { randomSeed } from '@/lib/sudoku/rng';
import { Board } from './Board';
import { Leaderboard } from './Leaderboard';
import { Actions, DigitPad } from './Pad';
import { Pixel } from './Pixel';
import { GAME_CHROME, useBoardSize, useKeyboard, useSudoku } from './useSudoku';

/** The seed lives in the URL (?g=…): reloading resumes, sharing the link shares the grid. */
export function SoloGame({ level }: { level: Level }) {
  const [game, setGame] = useState<{ seed: number; saved?: SavedSolo } | null>(null);

  const start = useCallback(
    (seed: number, saved?: SavedSolo) => {
      const url = new URL(window.location.href);
      url.searchParams.set('g', seed.toString(36));
      window.history.replaceState(null, '', url);
      setGame({ seed, saved });
    },
    [],
  );

  useEffect(() => {
    const g = new URLSearchParams(window.location.search).get('g');
    const seed = g ? parseInt(g, 36) >>> 0 : NaN;
    if (Number.isFinite(seed)) {
      const saved = readJSON<SavedSolo>(SOLO_KEY);
      start(seed, saved && saved.level === level && saved.seed === seed ? saved : undefined);
    } else start(randomSeed());
  }, [level, start]);

  if (!game) return <main className="screen" />;
  return <Play key={game.seed} level={level} seed={game.seed} saved={game.saved} onNew={() => start(randomSeed())} />;
}

function Play({
  level,
  seed,
  saved,
  onNew,
}: {
  level: Level;
  seed: number;
  saved?: SavedSolo;
  onNew: () => void;
}) {
  const g = geometryFor(level);
  const puzzle = useMemo(() => makePuzzle(level, seed), [level, seed]);
  const [state, dispatch] = useSudoku(g, puzzle.givens, saved);
  const { cell, u } = useBoardSize(g.n, GAME_CHROME);
  const [elapsed, setElapsed] = useState(saved?.elapsed ?? 0);
  const [best, setBest] = useState<{ time: number | null; record: boolean }>({ time: null, record: false });
  const elapsedRef = useRef(elapsed);
  elapsedRef.current = elapsed;
  useKeyboard(dispatch, g.n, !state.won);

  // leaderboard: the server notes when this grid started
  const [run, setRun] = useState<string | null>(saved?.run ?? null);
  const asked = useRef(false);
  useEffect(() => {
    if (run || state.won || asked.current) return;
    asked.current = true;
    api<{ run: string }>('/api/scores/start', { method: 'POST', body: { level, seed } })
      .then((r) => setRun(r.run))
      .catch(() => {
        /* offline: the grid still plays, just without leaderboard */
      });
  }, [run, state.won, level, seed]);

  // timer — only runs while the page is visible
  useEffect(() => {
    if (state.won) return;
    let last = performance.now();
    const id = window.setInterval(() => {
      const now = performance.now();
      const dt = Math.min(now - last, 1000);
      last = now;
      if (document.visibilityState === 'visible') setElapsed((e) => e + dt);
    }, 250);
    return () => window.clearInterval(id);
  }, [state.won]);

  // persistence
  const save = useCallback(() => {
    writeJSON(SOLO_KEY, {
      level,
      seed,
      values: state.values,
      notes: state.notes,
      elapsed: elapsedRef.current,
      won: state.won,
      run,
    } satisfies SavedSolo);
  }, [level, seed, state.values, state.notes, state.won, run]);
  useEffect(save, [save]);
  useEffect(() => {
    const id = window.setInterval(save, 3000);
    window.addEventListener('pagehide', save);
    return () => {
      window.clearInterval(id);
      window.removeEventListener('pagehide', save);
    };
  }, [save]);

  // personal best
  const wasWon = useRef(state.won);
  useEffect(() => {
    if (!state.won) return;
    const prev = readJSON<number>(bestKey(level));
    if (wasWon.current) {
      setBest({ time: prev, record: false });
      return;
    }
    wasWon.current = true;
    const record = prev === null || elapsedRef.current < prev;
    if (record) writeJSON(bestKey(level), Math.round(elapsedRef.current));
    setBest({ time: record ? null : prev, record });
  }, [state.won, level]);

  const boardW = g.n * cell + g.n + 1;

  return (
    <main className="screen game" style={{ '--board-w': `${boardW}px` } as CSSProperties}>
      <header className="bar">
        <Link href="/" className="icon-btn" aria-label="menu" style={{ justifySelf: 'start' }}>
          <Pixel rows={ICONS.back} />
        </Link>
        <span>{LEVEL_LABEL[level]}</span>
        <span className="timer" aria-label="temps">
          {formatTime(elapsed)}
        </span>
      </header>
      <section className="play">
        <Board g={g} state={state} dispatch={dispatch} cell={cell} u={u} />
        {state.won ? (
          <div className="done-panel" role="status">
            <div>
              résolu en {formatTime(elapsed)}
              {best.record && <span className="muted"> · record perso</span>}
            </div>
            <Leaderboard level={level} run={run} values={state.values} time={elapsed} />
          </div>
        ) : (
          <DigitPad n={g.n} state={state} dispatch={dispatch} />
        )}
      </section>
      <footer className="foot">
        {state.won ? (
          <div className="row">
            <button type="button" className="item" onClick={onNew}>
              nouvelle grille
            </button>
            <Link href="/" className="item">
              menu
            </Link>
          </div>
        ) : (
          <Actions state={state} dispatch={dispatch} />
        )}
      </footer>
    </main>
  );
}
