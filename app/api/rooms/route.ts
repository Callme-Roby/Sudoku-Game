import { body, handle } from '@/lib/server/http';
import { createRoom } from '@/lib/server/rooms';

export async function POST(req: Request) {
  return handle(async () => {
    const b = await body(req);
    return createRoom(b.mode, b.level, b.name);
  });
}
