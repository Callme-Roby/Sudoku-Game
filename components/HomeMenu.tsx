'use client';

import Link from 'next/link';
import { useEffect, useState, type CSSProperties } from 'react';
import { getName, saveName } from '@/lib/game/identity';
import { LEVEL_LABEL, LEVELS } from '@/lib/sudoku/bank';
import { ContinueLink } from './ContinueLink';
import { Scramble } from './Intro';

/** Intro timeline (ms): the logo writes itself 150–1210, labels decode from 950. */
const at = (i: number): CSSProperties => ({ animationDelay: `${950 + i * 65}ms` });

/** The menu — or, on the very first visit, the one-time first-name step. */
export function HomeMenu() {
  // undefined until we can read the device storage (the server renders the menu)
  const [name, setName] = useState<string | null | undefined>(undefined);
  useEffect(() => setName(getName()), []);

  if (name === null) return <Welcome onDone={setName} />;

  return (
    <nav className="menu" aria-label="menu">
      <ContinueLink />
      {LEVELS.map((level, i) => (
        <Link key={level} href={`/solo/${level}`} className="item intro-item" style={at(i)}>
          <Scramble text={LEVEL_LABEL[level]} />
        </Link>
      ))}
      <span className="sep intro-sep" aria-hidden style={at(5)} />
      <Link href="/defi" className="item intro-item" style={at(6)}>
        <Scramble text="Défier un ami" />
      </Link>
      <Link href="/royale" className="item intro-item" style={at(7)}>
        <Scramble text="Battle royale" />
      </Link>
      <span className="sep intro-sep" aria-hidden style={at(8)} />
      <Link href="/classement" className="item intro-item" style={at(9)}>
        <Scramble text="Classement" />
      </Link>
    </nav>
  );
}

function Welcome({ onDone }: { onDone: (name: string) => void }) {
  const [value, setValue] = useState('');
  const ready = value.trim().length > 0;
  return (
    <form
      className="menu welcome"
      onSubmit={(e) => {
        e.preventDefault();
        const saved = ready ? saveName(value) : null;
        if (saved) onDone(saved);
      }}
    >
      <label className="field intro-item" style={at(0)}>
        <span className="muted">Ton prénom</span>
        <input
          className="input"
          value={value}
          maxLength={16}
          autoComplete="given-name"
          enterKeyHint="go"
          onChange={(e) => setValue(e.target.value)}
        />
      </label>
      <button type="submit" className="item intro-item" style={at(1)} disabled={!ready}>
        <Scramble text="C’est parti" />
      </button>
      <p className="muted intro-item welcome-hint" style={at(2)}>
        Pour le classement et le jeu en ligne
      </p>
    </form>
  );
}
