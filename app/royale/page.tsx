import { CreateRoom } from '@/components/CreateRoom';

export const metadata = { title: 'Sudoku · Battle royale' };

export default function RoyalePage() {
  return <CreateRoom mode="royale" />;
}
