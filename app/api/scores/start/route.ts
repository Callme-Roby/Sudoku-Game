import { body, handle } from '@/lib/server/http';
import { startRun } from '@/lib/server/scores';

/** A solo grid starts: { level, seed } → { run } */
export async function POST(req: Request) {
  return handle(async () => {
    const b = await body(req);
    return startRun(b.level, b.seed);
  });
}
