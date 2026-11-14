// Browser-side helpers for scripts/make-logo.mjs: draw text, skeletonise (Zhang-Suen), resample to a pixel grid.
// Runs inside the browser page. Exposes window.pixelate(fontFamily, text, targetHeight, opts)
window.zhangSuen = function (img, w, h) {
  const g = Uint8Array.from(img);
  let changed = true;
  const idx = (x, y) => y * w + x;
  const P = (x, y) => (x < 0 || y < 0 || x >= w || y >= h ? 0 : g[idx(x, y)]);
  while (changed) {
    changed = false;
    for (let step = 0; step < 2; step++) {
      const del = [];
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        if (!g[idx(x, y)]) continue;
        const p2 = P(x, y - 1), p3 = P(x + 1, y - 1), p4 = P(x + 1, y), p5 = P(x + 1, y + 1),
          p6 = P(x, y + 1), p7 = P(x - 1, y + 1), p8 = P(x - 1, y), p9 = P(x - 1, y - 1);
        const n = [p2, p3, p4, p5, p6, p7, p8, p9];
        const B = n.reduce((a, b) => a + b, 0);
        if (B < 2 || B > 6) continue;
        let A = 0;
        for (let i = 0; i < 8; i++) if (!n[i] && n[(i + 1) % 8]) A++;
        if (A !== 1) continue;
        if (step === 0) { if (p2 * p4 * p6 || p4 * p6 * p8) continue; }
        else { if (p2 * p4 * p8 || p2 * p6 * p8) continue; }
        del.push(idx(x, y));
      }
      if (del.length) changed = true;
      for (const i of del) g[i] = 0;
    }
  }
  return g;
};
// remove redundant corner pixels so lines are strictly 1px (8-connected, no L-corners)
window.cleanCorners = function (g, w, h) {
  const P = (x, y) => (x < 0 || y < 0 || x >= w || y >= h ? 0 : g[y * w + x]);
  let changed = true;
  while (changed) {
    changed = false;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      if (!g[y * w + x]) continue;
      const N = P(x, y - 1), E = P(x + 1, y), S = P(x, y + 1), W = P(x - 1, y);
      const NE = P(x + 1, y - 1), SE = P(x + 1, y + 1), SW = P(x - 1, y + 1), NW = P(x - 1, y - 1);
      // L-corner: two orthogonal neighbours that are themselves diagonal, and nothing else on that corner
      const corners = [[N, E, SW, S, W, SE, NW], [E, S, NW, N, W, NE, SW], [S, W, NE, N, E, NW, SE], [W, N, SE, S, E, SW, NE]];
      for (const [a, b] of corners) {
        if (a && b) {
          // check removal keeps connectivity: count neighbours
          const nb = [N, NE, E, SE, S, SW, W, NW];
          const cnt = nb.reduce((s, v) => s + v, 0);
          // transitions
          let A = 0; for (let i = 0; i < 8; i++) if (!nb[i] && nb[(i + 1) % 8]) A++;
          if (A === 1 && cnt >= 2 && cnt <= 3) { g[y * w + x] = 0; changed = true; break; }
        }
      }
    }
  }
  return g;
};
window.pixelate = function (family, text, targetH, opts = {}) {
  const hiSize = opts.hiSize || 400;
  const c = document.createElement('canvas');
  const ctx = c.getContext('2d');
  ctx.font = `${opts.style || ''} ${hiSize}px "${family}"`;
  const m = ctx.measureText(text);
  const pad = hiSize * 0.3;
  const W = Math.ceil(m.width + pad * 2), H = Math.ceil(hiSize * 1.6);
  c.width = W; c.height = H;
  ctx.font = `${opts.style || ''} ${hiSize}px "${family}"`;
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = '#000';
  if (opts.skew) ctx.setTransform(1, 0, -opts.skew, 1, opts.skew * H * 0.7, 0);
  ctx.fillText(text, pad, H * 0.68);
  const d = ctx.getImageData(0, 0, W, H).data;
  const bin = new Uint8Array(W * H);
  for (let i = 0; i < W * H; i++) bin[i] = d[i * 4 + 3] > 110 ? 1 : 0;
  // bbox
  let x0 = W, y0 = H, x1 = 0, y1 = 0;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (bin[y * W + x]) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
  const sk = zhangSuen(bin, W, H);
  const s = (y1 - y0 + 1) / targetH;
  const w = Math.ceil((x1 - x0 + 1) / s) + 2, h = targetH + 2;
  const lo = new Uint8Array(w * h);
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (sk[y * W + x]) {
    const lx = Math.floor((x - x0) / s) + 1, ly = Math.floor((y - y0) / s) + 1;
    lo[ly * w + lx] = 1;
  }
  let out = zhangSuen(lo, w, h);
  out = cleanCorners(out, w, h);
  return { w, h, bits: Array.from(out) };
};
window.drawBits = function (r, scale, label) {
  const wrap = document.createElement('div');
  wrap.style.cssText = 'margin:10px 20px;display:flex;align-items:center;gap:20px;font:12px monospace;color:#888';
  const c = document.createElement('canvas');
  c.width = r.w * scale; c.height = r.h * scale;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#f1efe9'; ctx.fillRect(0, 0, c.width, c.height);
  ctx.fillStyle = '#222220';
  for (let y = 0; y < r.h; y++) for (let x = 0; x < r.w; x++) if (r.bits[y * r.w + x]) ctx.fillRect(x * scale, y * scale, scale, scale);
  const l = document.createElement('span'); l.textContent = label;
  wrap.append(c, l); document.body.append(wrap);
};
