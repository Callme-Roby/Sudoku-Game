import { CreateRoom } from '@/components/CreateRoom';

export const metadata = { title: 'sudoku · battle royale' };

export default function RoyalePage() {
  return <CreateRoom mode="royale" />;
}
