import { handle } from '@/lib/server/http';
import { getRoom, HttpError, normalizeCode } from '@/lib/server/rooms';

export const dynamic = 'force-dynamic';

export async function GET(req: Request, { params }: { params: Promise<{ code: string }> }) {
  return handle(async () => {
    const code = normalizeCode((await params).code);
    if (!code) throw new HttpError(404, 'partie introuvable');
    return getRoom(code, req.headers.get('x-player'));
  });
}
