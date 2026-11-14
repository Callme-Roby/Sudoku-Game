import { CreateRoom } from '@/components/CreateRoom';

export const metadata = { title: 'Sudoku · Défi' };

export default function DefiPage() {
  return <CreateRoom mode="duel" />;
}
