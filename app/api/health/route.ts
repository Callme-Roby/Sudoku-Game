import { NextResponse } from 'next/server';
import { storageStatus } from '@/lib/server/store';

export const dynamic = 'force-dynamic';

/** Quick check after deploying: { storage: "redis", reachable: true } means rooms and leaderboards are shared. */
export async function GET() {
  return NextResponse.json(await storageStatus(), { headers: { 'Cache-Control': 'no-store' } });
}
