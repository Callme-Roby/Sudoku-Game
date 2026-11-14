import { body, handle } from '@/lib/server/http';
import { submitRun } from '@/lib/server/scores';

/** Submit a solved grid: { run, player, name, values, time } → leaderboard */
export async function POST(req: Request) {
  return handle(async () => submitRun(await body(req)));
}
