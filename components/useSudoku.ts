'use client';

import { useEffect, useMemo, useReducer, useState } from 'react';
import { createReducer, initialState, type Action, type GameState } from '@/lib/game/state';
import type { Geometry } from '@/lib/sudoku/geometry';

export function useSudoku(g: Geometry, givens: number[], saved?: Parameters<typeof initialState>[1]) {
  const reducer = useMemo(() => createReducer(g), [g]);
  const [state, dispatch] = useReducer(reducer, undefined, () => initialState(givens, saved));
  return [state, dispatch] as const;
}

/** Keyboard: digits, arrows, backspace, n (notes), ctrl/cmd+z, escape. */
export function useKeyboard(dispatch: (a: Action) => void, n: number, enabled = true) {
  useEffect(() => {
    if (!enabled) return;
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA')) return;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        dispatch({ type: 'undo' });
        return;
      }
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const digit = /^Digit([1-9])$/.exec(e.code)?.[1] ?? /^Numpad([1-9])$/.exec(e.code)?.[1];
      if (digit && Number(digit) <= n) {
        e.preventDefault();
        dispatch({ type: 'input', digit: Number(digit) });
        return;
      }
      const moves: Record<string, [number, number]> = {
        ArrowUp: [-1, 0],
        ArrowDown: [1, 0],
        ArrowLeft: [0, -1],
        ArrowRight: [0, 1],
      };
      if (moves[e.key]) {
        e.preventDefault();
        dispatch({ type: 'move', dr: moves[e.key][0], dc: moves[e.key][1] });
      } else if (e.key === 'Backspace' || e.key === 'Delete' || e.code === 'Digit0' || e.code === 'Numpad0') {
        e.preventDefault();
        dispatch({ type: 'erase' });
      } else if (e.key === 'n' || e.key === 'N') {
        dispatch({ type: 'toggleNotes' });
      } else if (e.key === 'Escape') {
        dispatch({ type: 'select', index: null });
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [dispatch, n, enabled]);
}

/** Integer cell size that fits the viewport, and the matching pixel unit. */
export function useBoardSize(n: number, reservedHeight = 260) {
  const [size, setSize] = useState({ cell: n === 9 ? 38 : 56, u: 2 });
  useEffect(() => {
    const calc = () => {
      const w = Math.min(window.innerWidth, 560) - 32;
      const h = window.innerHeight - reservedHeight;
      const avail = Math.max(Math.min(w, h), n * 30);
      const max = n === 9 ? 56 : 76;
      const cell = Math.max(28, Math.min(max, Math.floor((avail - (n + 1)) / n)));
      setSize({ cell, u: cell >= 64 ? 3 : 2 });
    };
    calc();
    window.addEventListener('resize', calc);
    return () => window.removeEventListener('resize', calc);
  }, [n, reservedHeight]);
  return size;
}

export type { GameState, Action };
