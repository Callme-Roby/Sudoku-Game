"""App icons: one sudoku box drawn with the game's own pixel digits.

    python3 scripts/make-icons.py      (needs Pillow)
"""
import re
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
src = (ROOT / 'lib/pixel/glyphs.ts').read_text()
block = src[src.index('export const DIGITS') : src.index('export const MINI_DIGITS')]
DIGITS = {
    int(m.group(1)): re.findall(r"'([.#]+)'", m.group(2))
    for m in re.finditer(r'(\d): \[(.*?)\]', block, re.S)
}

PAPER = (0xEF, 0xED, 0xE7)
INK = (0x1F, 0x1E, 0x1C)
SOFT = (0x5F, 0x5D, 0x58)
LINE = (0xC4, 0xC1, 0xB8)
SEL = (0xD8, 0xD5, 0xCD)
CELLS = {(0, 0): (5, INK, None), (2, 0): (1, INK, None), (1, 1): (3, INK, SEL), (0, 2): (7, INK, None), (2, 2): (9, SOFT, None)}
C = 13  # cell size in pixels
N = 3 * C + 4  # box size including lines


def make(size: int, scale: int, path: Path) -> None:
    im = Image.new('RGB', (size, size), PAPER)
    o = (size - N * scale) // 2

    def px(x: int, y: int, col) -> None:
        im.paste(col, (o + x * scale, o + y * scale, o + (x + 1) * scale, o + (y + 1) * scale))

    for (cx, cy), (d, col, bg) in CELLS.items():
        x0, y0 = 1 + cx * (C + 1), 1 + cy * (C + 1)
        if bg:
            for y in range(C):
                for x in range(C):
                    px(x0 + x, y0 + y, bg)
        for y, row in enumerate(DIGITS[d]):
            for x, ch in enumerate(row):
                if ch == '#':
                    px(x0 + 3 + x, y0 + 1 + y, col)
    for k in range(N):
        for t in (C + 1, 2 * (C + 1)):
            px(t, k, LINE)
            px(k, t, LINE)
    for k in range(N):
        for a, b in ((0, k), (N - 1, k), (k, 0), (k, N - 1)):
            px(a, b, INK)
    path.parent.mkdir(parents=True, exist_ok=True)
    im.save(path, optimize=True)


make(64, 1, ROOT / 'app/icon.png')
make(180, 3, ROOT / 'app/apple-icon.png')
make(192, 3, ROOT / 'public/icons/icon-192.png')
make(512, 8, ROOT / 'public/icons/icon-512.png')
print('icons written')
