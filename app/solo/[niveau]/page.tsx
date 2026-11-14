import { notFound } from 'next/navigation';
import { SoloGame } from '@/components/SoloGame';
import { isLevel, LEVEL_LABEL, LEVELS } from '@/lib/sudoku/bank';

export function generateStaticParams() {
  return LEVELS.map((niveau) => ({ niveau }));
}

export async function generateMetadata({ params }: { params: Promise<{ niveau: string }> }) {
  const { niveau } = await params;
  return { title: isLevel(niveau) ? `Sudoku · ${LEVEL_LABEL[niveau]}` : 'Sudoku' };
}

export default async function SoloPage({ params }: { params: Promise<{ niveau: string }> }) {
  const { niveau } = await params;
  if (!isLevel(niveau)) notFound();
  return <SoloGame level={niveau} />;
}
