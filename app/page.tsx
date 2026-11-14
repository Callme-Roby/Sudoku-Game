import Link from 'next/link';
import { ContinueLink } from '@/components/ContinueLink';
import { Logo } from '@/components/Logo';
import { LEVEL_LABEL, LEVELS } from '@/lib/sudoku/bank';

export default function Home() {
  return (
    <div className="home-page">
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
      <footer>
        <a className="credit" href="https://callmeroby.com" target="_blank" rel="noopener">
          un jeu de Studio Roby <span className="dim">·</span> <span className="url">callmeroby.com</span>
        </a>
      </footer>
    </div>
  );
}
