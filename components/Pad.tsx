'use client';

import type { CSSProperties } from 'react';
import { digitCounts, type Action, type GameState } from '@/lib/game/state';
import { DIGITS, ICONS } from '@/lib/pixel/glyphs';
import { Pixel } from './Pixel';

export function Pad({ n, state, dispatch }: { n: number; state: GameState; dispatch: (a: Action) => void }) {
  const counts = digitCounts(state.values, n);
  return (
    <div className="pad">
      <div className="digits" style={{ '--n': n } as CSSProperties}>
        {Array.from({ length: n }, (_, k) => k + 1).map((d) => (
          <button
            key={d}
            type="button"
            className={counts[d] >= n ? 'digit done' : 'digit'}
            aria-label={String(d)}
            onPointerDown={(e) => {
              e.preventDefault();
              dispatch({ type: 'input', digit: d });
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') dispatch({ type: 'input', digit: d });
            }}
          >
            <Pixel rows={DIGITS[d]} />
          </button>
        ))}
      </div>
      <div className="actions">
        <button type="button" className="action" onClick={() => dispatch({ type: 'undo' })}>
          <span className="ico">
            <Pixel rows={ICONS.undo} />
          </span>
          <span className="label">annuler</span>
        </button>
        <button type="button" className="action" onClick={() => dispatch({ type: 'erase' })}>
          <span className="ico">
            <Pixel rows={ICONS.erase} />
          </span>
          <span className="label">effacer</span>
        </button>
        <button
          type="button"
          className="action"
          aria-pressed={state.notesMode}
          onClick={() => dispatch({ type: 'toggleNotes' })}
        >
          <span className="ico">
            <Pixel rows={ICONS.pencil} />
          </span>
          <span className="label">notes</span>
        </button>
      </div>
    </div>
  );
}
