import { CreateRoom } from '@/components/CreateRoom';

export const metadata = { title: 'sudoku · défi' };

export default function DefiPage() {
  return <CreateRoom mode="duel" />;
}
