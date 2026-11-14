import { handle } from '@/lib/server/http';
import { getBoard } from '@/lib/server/scores';

export const dynamic = 'force-dynamic';

/** Top times for a level; ?p=<player id> adds that player's own line, ?n= size of the top (≤ 20) */
export async function GET(req: Request, { params }: { params: Promise<{ level: string }> }) {
  const q = new URL(req.url).searchParams;
  return handle(async () => getBoard((await params).level, q.get('p'), q.get('n') ?? undefined));
}
