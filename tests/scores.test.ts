import { afterEach, describe, expect, it, vi } from 'vitest';
import { makePuzzle } from '../lib/sudoku/bank.ts';
import { gridToString } from '../lib/sudoku/geometry.ts';
import { getBoard, renamePlayer, startRun, submitRun } from '../lib/server/scores.ts';

const solved = (seed: number) => gridToString(makePuzzle('mini', seed).solution);

async function play(player: string, name: string, seconds: number, seed: number, errors = 0) {
  const { run } = await startRun('mini', seed);
  vi.setSystemTime(Date.now() + seconds * 1000);
  return submitRun({ run, player, name, values: solved(seed), time: seconds * 1000, errors });
}

describe('leaderboard', () => {
  afterEach(() => vi.useRealTimers());

  it('ranks best times per player and shows names', async () => {
    vi.useFakeTimers();
    await play('player-aaaa', 'Léa', 40, 1);
    await play('player-bbbb', 'Hugo', 30, 2);
    const board = await play('player-aaaa', 'Léa', 55, 3); // slower: best stays 40 s
    expect(board.top.map((l) => [l.name, l.time])).toEqual([
      ['Hugo', 30000],
      ['Léa', 40000],
    ]);
    expect(board.top.find((l) => l.me)?.name).toBe('Léa');
    const improved = await play('player-aaaa', 'Léa', 25, 4);
    expect(improved.top[0]).toMatchObject({ name: 'Léa', time: 25000, rank: 1, me: true });
  });

  it('shows my own line when I am outside the top', async () => {
    vi.useFakeTimers();
    for (let i = 0; i < 6; i++) await play(`player-top${i}`, `p${i}`, 20 + i, 10 + i);
    const board = await play('player-slow', 'Sam', 90, 20);
    expect(board.top).toHaveLength(5);
    expect(board.mine).toMatchObject({ name: 'Sam', time: 90000, me: true });
    expect(board.mine!.rank).toBeGreaterThan(5);
    expect((await getBoard('mini', 'player-slow')).mine?.name).toBe('Sam');
  });

  it('rejects wrong grids, impossible or inflated times, and replays', async () => {
    vi.useFakeTimers();
    const { run } = await startRun('mini', 99);
    vi.setSystemTime(Date.now() + 60_000);
    const values = solved(99);
    const wrong = values.replace(/^(.)(.)/, '$2$1');
    await expect(submitRun({ run, player: 'player-cheat', name: 'x', values: wrong, time: 50_000 })).rejects.toThrow(/grille/i);
    // faster than humanly possible
    await expect(submitRun({ run, player: 'player-cheat', name: 'x', values, time: 2_000 })).rejects.toThrow(/temps/i);
    // claiming more time than really elapsed is impossible: the client clock only pauses
    await expect(submitRun({ run, player: 'player-cheat', name: 'x', values, time: 120_000 })).rejects.toThrow(/temps/i);
    await submitRun({ run, player: 'player-cheat', name: 'x', values, time: 50_000 });
    await expect(submitRun({ run, player: 'player-cheat', name: 'x', values, time: 50_000 })).rejects.toThrow(/inconnue/i);
  });
});

describe('leaderboard names and sizes', () => {
  afterEach(() => vi.useRealTimers());

  it('renames a player on the boards where they appear, and sizes the top', async () => {
    vi.useFakeTimers();
    await play('player-rename', 'Mia', 30, 41);
    await play('player-other1', 'Zoé', 31, 42);
    const r = await renamePlayer({ player: 'player-rename', name: '  Mia   B ' });
    expect(r).toEqual({ name: 'Mia B', boards: 1 });
    const board = await getBoard('mini', 'player-rename', 20);
    expect(board.top.find((l) => l.me)?.name).toBe('Mia B');
    expect((await getBoard('mini', null, 1)).top).toHaveLength(1);
    expect((await getBoard('mini', null, 500)).top.length).toBeLessThanOrEqual(20);
  });
});

describe('leaderboard errors', () => {
  afterEach(() => vi.useRealTimers());

  it('shows the errors of the grid that set the best time', async () => {
    vi.useFakeTimers();
    let board = await play('player-errs', 'Nina', 40, 61, 2);
    const mine = () => board.top.find((l) => l.me) ?? board.mine;
    expect(mine()).toMatchObject({ time: 40000, errors: 2 });
    // slower, cleaner grid: best time and its errors stay
    board = await play('player-errs', 'Nina', 50, 62, 0);
    expect(mine()).toMatchObject({ time: 40000, errors: 2 });
    // faster grid: new time, new errors
    board = await play('player-errs', 'Nina', 35, 63, 1);
    expect(mine()).toMatchObject({ time: 35000, errors: 1 });
    // renaming keeps the errors
    await renamePlayer({ player: 'player-errs', name: 'Nina R' });
    const after = await getBoard('mini', 'player-errs', 20);
    expect(after.top.find((l) => l.me)).toMatchObject({ name: 'Nina R', errors: 1 });
  });

  it('rejects impossible error counts', async () => {
    vi.useFakeTimers();
    for (const errors of [4, -1, 1.5]) {
      const { run } = await startRun('mini', 70);
      vi.setSystemTime(Date.now() + 40_000);
      await expect(
        submitRun({ run, player: 'player-bad', name: 'x', values: solved(70), time: 40_000, errors }),
      ).rejects.toThrow(/erreurs/i);
    }
  });
});
