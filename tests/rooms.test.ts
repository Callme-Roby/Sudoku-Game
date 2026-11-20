import { afterEach, describe, expect, it, vi } from 'vitest';
import { makePuzzle } from '../lib/sudoku/bank.ts';
import { gridToString } from '../lib/sudoku/geometry.ts';
import { createRoom, getRoom, joinRoom, rematch, reportProgress, startRoom } from '../lib/server/rooms.ts';

const auth = (r: { id: string; token: string }) => `${r.id}:${r.token}`;

async function startedRoom(mode: 'duel' | 'royale') {
  const a = await createRoom(mode, 'mini', 'Léa');
  const b = await joinRoom(a.code, 'Hugo');
  const room = await startRoom(a.code, auth(a));
  vi.setSystemTime(room.startAt! + 1000);
  const p = makePuzzle('mini', room.seed);
  const half = p.solution.map((v, i) => (p.givens[i] || i % 2 ? v : 0));
  return { a, b, room, solved: gridToString(p.solution), half: gridToString(half) };
}

describe('duel', () => {
  afterEach(() => vi.useRealTimers());

  it('stops both games at the first finish, with progress and time for each', async () => {
    vi.useFakeTimers();
    const { a, b, room, solved, half } = await startedRoom('duel');
    await reportProgress(a.code, auth(b), { round: room.round, values: half });
    vi.setSystemTime(Date.now() + 30_000);
    const end = await reportProgress(a.code, auth(a), { round: room.round, values: solved });
    expect(end.endedAt).not.toBeNull();
    // Hugo keeps typing after the end: ignored, his progress stays frozen
    vi.setSystemTime(Date.now() + 5_000);
    const late = await reportProgress(a.code, auth(b), { round: room.round, values: solved });
    const hugo = late.players.find((p) => p.name === 'Hugo')!;
    const lea = late.players.find((p) => p.name === 'Léa')!;
    expect(hugo.finishedMs).toBeNull();
    expect(hugo.progress).toBeGreaterThan(0);
    expect(hugo.progress).toBeLessThan(1);
    expect(lea).toMatchObject({ progress: 1, timeMs: lea.finishedMs });
    expect(hugo.timeMs).toBe(lea.finishedMs);
    // the host can start the next round, which is open again
    const next = await rematch(a.code, auth(a));
    expect(next.endedAt).toBeNull();
    expect(next.round).toBe(room.round + 1);
  });

  it('ends when the opponent drops out', async () => {
    vi.useFakeTimers();
    const { a, b, room } = await startedRoom('duel');
    vi.setSystemTime(Date.now() + 12_000);
    const r = await reportProgress(a.code, auth(b), { round: room.round, eliminated: true });
    expect(r.endedAt).not.toBeNull();
    expect(r.players.find((p) => p.name === 'Hugo')).toMatchObject({ eliminated: true, timeMs: 13_000 });
  });

  it('battle royale keeps going after a finish', async () => {
    vi.useFakeTimers();
    const { a, b, room, solved, half } = await startedRoom('royale');
    await reportProgress(a.code, auth(a), { round: room.round, values: solved });
    const r = await reportProgress(a.code, auth(b), { round: room.round, values: half });
    expect(r.endedAt).toBeNull();
    expect((await getRoom(a.code, null)).players.find((p) => p.name === 'Hugo')!.progress).toBeGreaterThan(0);
  });
});
