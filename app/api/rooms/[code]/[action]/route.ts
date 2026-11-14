import { body, handle } from '@/lib/server/http';
import { HttpError, joinRoom, normalizeCode, rematch, reportProgress, startRoom } from '@/lib/server/rooms';

export async function POST(req: Request, { params }: { params: Promise<{ code: string; action: string }> }) {
  return handle(async () => {
    const p = await params;
    const code = normalizeCode(p.code);
    if (!code) throw new HttpError(404, 'partie introuvable');
    const auth = req.headers.get('x-player');
    switch (p.action) {
      case 'join':
        return joinRoom(code, (await body(req)).name);
      case 'start':
        return startRoom(code, auth);
      case 'progress':
        return reportProgress(code, auth, await body(req));
      case 'rematch':
        return rematch(code, auth);
      default:
        throw new HttpError(404, 'action inconnue');
    }
  });
}
