'use client';

import { memo, type CSSProperties } from 'react';
import { conflicts, type Action, type GameState } from '@/lib/game/state';
import { DIGITS, MINI_DIGITS } from '@/lib/pixel/glyphs';
import { bit, type Geometry } from '@/lib/sudoku/geometry';
import { Pixel } from './Pixel';

interface Props {
  g: Geometry;
  state: GameState;
  dispatch: (a: Action) => void;
  cell: number;
  u: number;
}

export function Board({ g, state, dispatch, cell, u }: Props) {
  const { values, notes, givens, selected } = state;
  const bad = conflicts(values, g);
  const selVal = selected !== null ? values[selected] : 0;
  const lines: CSSProperties[] = [];
  for (let k = 0; k < g.n - 1; k++) {
    const at = (k + 1) * cell + k;
    if ((k + 1) % g.bc === 0) lines.push({ left: at, top: 0, bottom: 0, width: 1 });
    if ((k + 1) % g.br === 0) lines.push({ top: at, left: 0, right: 0, height: 1 });
  }

  return (
    <div
      className={state.won ? 'board won' : 'board'}
      role="group"
      aria-label="grille"
      style={{ '--n': g.n, '--cell': `${cell}px`, '--u': `${u}px` } as CSSProperties}
    >
      {values.map((v, i) => {
        const r = g.rowOf[i];
        const c = g.colOf[i];
        let cls = 'cell';
        if (givens[i]) cls += ' given';
        if (selected !== null) {
          if (i === selected) cls += ' sel';
          else if (selVal && v === selVal) cls += ' same';
          else if (g.rowOf[selected] === r || g.colOf[selected] === c || g.boxOf[selected] === g.boxOf[i])
            cls += ' zone';
        }
        if (bad.has(i) && !givens[i]) cls += ' bad';
        return (
          <Cell
            key={i}
            index={i}
            cls={cls}
            value={v}
            notes={notes[i]}
            n={g.n}
            hit={selVal}
            delay={r + c}
            label={`ligne ${r + 1}, colonne ${c + 1}${v ? `, ${v}` : ''}`}
            dispatch={dispatch}
          />
        );
      })}
      {lines.map((s, k) => (
        <span key={k} className="boxline" style={s} />
      ))}
    </div>
  );
}

const Cell = memo(function Cell({
  index,
  cls,
  value,
  notes,
  n,
  hit,
  delay,
  label,
  dispatch,
}: {
  index: number;
  cls: string;
  value: number;
  notes: number;
  n: number;
  hit: number;
  delay: number;
  label: string;
  dispatch: (a: Action) => void;
}) {
  return (
    <div
      className={cls}
      role="button"
      aria-label={label}
      aria-pressed={cls.includes(' sel')}
      style={{ '--d': delay } as CSSProperties}
      onPointerDown={(e) => {
        e.preventDefault();
        dispatch({ type: 'select', index });
      }}
    >
      {value ? (
        <Pixel rows={DIGITS[value]} />
      ) : notes ? (
        <div className="notes" style={{ '--rows': Math.ceil(n / 3) } as CSSProperties}>
          {Array.from({ length: n }, (_, k) => k + 1).map((d) => (
            <span key={d} className={d === hit ? 'hit' : undefined}>
              {notes & bit(d) ? <Pixel rows={MINI_DIGITS[d]} /> : null}
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
});
