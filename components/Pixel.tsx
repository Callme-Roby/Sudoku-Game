import { bitmapPath, type Bitmap } from '@/lib/pixel/glyphs';

/** Renders a bitmap as crisp SVG; one bitmap pixel = var(--u). */
export function Pixel({ rows, label, className }: { rows: Bitmap; label?: string; className?: string }) {
  const w = rows[0].length;
  const h = rows.length;
  return (
    <svg
      className={className ? `px ${className}` : 'px'}
      viewBox={`0 0 ${w} ${h}`}
      style={{ width: `calc(var(--u) * ${w})`, height: `calc(var(--u) * ${h})` }}
      shapeRendering="crispEdges"
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      <path d={bitmapPath(rows)} fill="currentColor" />
    </svg>
  );
}
