import Link from 'next/link';
import { ContinueLink } from '@/components/ContinueLink';
import { IntroDone, Scramble } from '@/components/Intro';
import { Logo } from '@/components/Logo';
import { LEVEL_LABEL, LEVELS } from '@/lib/sudoku/bank';

/** Intro timeline (ms): the logo writes itself 150–1210, labels decode from 950. */
const at = (i: number) => ({ animationDelay: `${950 + i * 65}ms` });

export default function Home() {
  return (
    <div className="home-page">
      <main className="screen home">
        <Logo />
        <nav className="menu" aria-label="menu">
          <ContinueLink />
          {LEVELS.map((level, i) => (
            <Link key={level} href={`/solo/${level}`} className="item intro-item" style={at(i)}>
              <Scramble text={LEVEL_LABEL[level]} />
            </Link>
          ))}
          <span className="sep intro-sep" aria-hidden style={at(5)} />
          <Link href="/defi" className="item intro-item" style={at(6)}>
            <Scramble text="défier un ami" />
          </Link>
          <Link href="/royale" className="item intro-item" style={at(7)}>
            <Scramble text="battle royale" />
          </Link>
        </nav>
      </main>
      <footer>
        <a className="credit intro-credit" href="https://callmeroby.com" target="_blank" rel="noopener">
          un jeu de Studio Roby <span className="dim">·</span> <span className="url">callmeroby.com</span>
        </a>
      </footer>
      <IntroDone />
    </div>
  );
}
