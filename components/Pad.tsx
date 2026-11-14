'use client';

import type { CSSProperties, ReactNode } from 'react';
import { digitCounts, type Action, type GameState } from '@/lib/game/state';
import { DIGITS, ICONS, type Bitmap } from '@/lib/pixel/glyphs';
import { Pixel } from './Pixel';

type Dispatch = (a: Action) => void;

/** Digits row — sits right under the grid. */
export function DigitPad({ n, state, dispatch }: { n: number; state: GameState; dispatch: Dispatch }) {
  const counts = digitCounts(state.values, n);
  return (
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
  );
}

export function ActionButton({
  icon,
  label,
  pressed,
  disabled,
  onClick,
}: {
  icon: Bitmap;
  label: string;
  pressed?: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button type="button" className="action" aria-pressed={pressed} disabled={disabled} onClick={onClick}>
      <span className="ico">
        <Pixel rows={icon} />
      </span>
      <span className="label">{label}</span>
    </button>
  );
}

/** Undo / erase / notes — the footer block. */
export function Actions({ state, dispatch, extra }: { state: GameState; dispatch: Dispatch; extra?: ReactNode }) {
  return (
    <div className="actions">
      <ActionButton icon={ICONS.undo} label="Annuler" onClick={() => dispatch({ type: 'undo' })} />
      <ActionButton icon={ICONS.erase} label="Effacer" onClick={() => dispatch({ type: 'erase' })} />
      <ActionButton
        icon={ICONS.pencil}
        label="Notes"
        pressed={state.notesMode}
        onClick={() => dispatch({ type: 'toggleNotes' })}
      />
      {extra}
    </div>
  );
}
