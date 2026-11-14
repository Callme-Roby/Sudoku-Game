import Link from 'next/link';
import { ContinueLink } from '@/components/ContinueLink';
import { Logo } from '@/components/Logo';
import { LEVEL_LABEL, LEVELS } from '@/lib/sudoku/bank';

export default function Home() {
  return (
    <main className="screen home">
      <Logo />
      <nav className="menu" aria-label="menu">
        <ContinueLink />
        {LEVELS.map((level) => (
          <Link key={level} href={`/solo/${level}`} className="item">
            {LEVEL_LABEL[level]}
          </Link>
        ))}
        <span className="sep" aria-hidden />
        <Link href="/defi" className="item">
          défier un ami
        </Link>
        <Link href="/royale" className="item">
          battle royale
        </Link>
      </nav>
    </main>
  );
}
