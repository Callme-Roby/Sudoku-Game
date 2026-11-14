import { body, handle } from '@/lib/server/http';
import { renamePlayer } from '@/lib/server/scores';

/** { player, name } — updates the name on the boards where this player appears */
export async function POST(req: Request) {
  return handle(async () => renamePlayer(await body(req)));
}
