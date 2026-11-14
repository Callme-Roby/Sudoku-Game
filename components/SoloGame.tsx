'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { bestKey, formatTime, readJSON, SOLO_KEY, writeJSON, type SavedSolo } from '@/lib/game/local';
import { ICONS } from '@/lib/pixel/glyphs';
import { geometryFor, LEVEL_LABEL, makePuzzle, type Level } from '@/lib/sudoku/bank';
import { randomSeed } from '@/lib/sudoku/rng';
import { Board } from './Board';
import { Pad } from './Pad';
import { Pixel } from './Pixel';
import { useBoardSize, useKeyboard, useSudoku } from './useSudoku';

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
  const { cell, u } = useBoardSize(g.n);
  const [elapsed, setElapsed] = useState(saved?.elapsed ?? 0);
  const [best, setBest] = useState<{ time: number | null; record: boolean }>({ time: null, record: false });
  const elapsedRef = useRef(elapsed);
  elapsedRef.current = elapsed;
  useKeyboard(dispatch, g.n, !state.won);

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
    } satisfies SavedSolo);
  }, [level, seed, state.values, state.notes, state.won]);
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
    <main className="screen" style={{ '--board-w': `${boardW}px` } as CSSProperties}>
      <header className="bar" style={{ width: boardW, maxWidth: '100%' }}>
        <Link href="/" className="icon-btn" aria-label="menu" style={{ justifySelf: 'start' }}>
          <Pixel rows={ICONS.back} />
        </Link>
        <span>{LEVEL_LABEL[level]}</span>
        <span className="timer" aria-label="temps">
          {formatTime(elapsed)}
        </span>
      </header>
      <div className="stage">
        <Board g={g} state={state} dispatch={dispatch} cell={cell} u={u} />
        {state.won ? (
          <div className="done-panel" role="status">
            <div>résolu en {formatTime(elapsed)}</div>
            <div className="muted">
              {best.record ? 'nouveau record' : best.time !== null ? `record ${formatTime(best.time)}` : ' '}
            </div>
            <div className="row">
              <button type="button" className="item" onClick={onNew}>
                nouvelle grille
              </button>
              <Link href="/" className="item">
                menu
              </Link>
            </div>
          </div>
        ) : (
          <Pad n={g.n} state={state} dispatch={dispatch} />
        )}
      </div>
    </main>
  );
}
