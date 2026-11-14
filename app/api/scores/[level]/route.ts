import { handle } from '@/lib/server/http';
import { getBoard } from '@/lib/server/scores';

export const dynamic = 'force-dynamic';

/** Top times for a level; ?p=<player id> adds that player's own line */
export async function GET(req: Request, { params }: { params: Promise<{ level: string }> }) {
  return handle(async () => getBoard((await params).level, new URL(req.url).searchParams.get('p')));
}
