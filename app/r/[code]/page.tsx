import { notFound } from 'next/navigation';
import { Room } from '@/components/Room';
import { normalizeCode } from '@/lib/server/rooms';

export const metadata = { title: 'Sudoku · Partie' };

export default async function RoomPage({ params }: { params: Promise<{ code: string }> }) {
  const code = normalizeCode((await params).code);
  if (!code) notFound();
  return <Room code={code} />;
}
