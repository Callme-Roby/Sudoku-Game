import type { CSSProperties } from 'react';
import { LOGO } from '@/lib/pixel/logo';
import { strokeFrames } from '@/lib/pixel/trace';

const FRAMES = strokeFrames(LOGO, 60);
const W = LOGO[0].length;
const H = LOGO.length;

/** The logo, split into 60 frames so it can write itself on the first visit. */
export function Logo() {
  return (
    <h1 className="logo-wrap" style={{ margin: 0 }}>
      <svg
        className="px logo intro-logo"
        viewBox={`0 0 ${W} ${H}`}
        style={{ width: `calc(var(--u) * ${W})`, height: `calc(var(--u) * ${H})` }}
        shapeRendering="crispEdges"
        role="img"
        aria-label="Sudoku"
      >
        {FRAMES.map((d, k) => (d ? <path key={k} d={d} fill="currentColor" style={{ '--k': k } as CSSProperties} /> : null))}
      </svg>
    </h1>
  );
}
