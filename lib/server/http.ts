import { NextResponse } from 'next/server';
import { HttpError } from './rooms.ts';

export async function handle(fn: () => Promise<unknown>): Promise<NextResponse> {
  try {
    return NextResponse.json(await fn(), { headers: { 'Cache-Control': 'no-store' } });
  } catch (e) {
    if (e instanceof HttpError) return NextResponse.json({ error: e.message }, { status: e.status });
    console.error(e);
    return NextResponse.json({ error: 'erreur serveur' }, { status: 500 });
  }
}

export async function body(req: Request): Promise<Record<string, unknown>> {
  try {
    return (await req.json()) as Record<string, unknown>;
  } catch {
    return {};
  }
}
