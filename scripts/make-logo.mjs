/**
 * Turns a script font into the fine pixel-art logo (lib/pixel/logo.ts):
 * the text is drawn large, skeletonised to a 1-pixel line (Zhang-Suen),
 * then resampled onto a small pixel grid.
 *
 *   node scripts/make-logo.mjs <font.woff2|ttf> [height=38] [text=sudoku]
 *
 * The current logo: Great Vibes (OFL, `npm i @fontsource/great-vibes`), height 52, text "Sudoku".
 * Needs Playwright with Chromium (`npx playwright install chromium`).
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const [fontPath, height = '38', text = 'sudoku'] = process.argv.slice(2);
if (!fontPath) {
  console.error('usage: node scripts/make-logo.mjs <font file> [height] [text]');
  process.exit(1);
}

const { chromium } = await import('playwright');
const font = readFileSync(fontPath).toString('base64');
const helpers = fileURLToPath(new URL('./pixelate-font.js', import.meta.url));

const browser = await chromium.launch();
const page = await browser.newPage();
await page.setContent(`<style>@font-face{font-family:"logo";src:url(data:font/woff2;base64,${font})}</style>`);
await page.addScriptTag({ path: helpers });
const r = await page.evaluate(
  async ({ height, text }) => {
    await document.fonts.load('40px "logo"');
    return window.pixelate('logo', text, height);
  },
  { height: Number(height), text },
);
await browser.close();

// crop to the drawn pixels
let [x0, y0, x1, y1] = [r.w, r.h, 0, 0];
for (let y = 0; y < r.h; y++)
  for (let x = 0; x < r.w; x++)
    if (r.bits[y * r.w + x]) [x0, y0, x1, y1] = [Math.min(x0, x), Math.min(y0, y), Math.max(x1, x), Math.max(y1, y)];
const rows = [];
for (let y = y0; y <= y1; y++) {
  let s = '';
  for (let x = x0; x <= x1; x++) s += r.bits[y * r.w + x] ? '#' : '.';
  rows.push(s);
}
const out = fileURLToPath(new URL('../lib/pixel/logo.ts', import.meta.url));
writeFileSync(
  out,
  `/** "${text}" — script font skeletonised to a 1-pixel line (scripts/make-logo.mjs). */\nexport const LOGO: string[] = [\n${rows
    .map((s) => `  '${s}',`)
    .join('\n')}\n];\n`,
);
console.log(`wrote ${out} (${x1 - x0 + 1}×${y1 - y0 + 1})`);
