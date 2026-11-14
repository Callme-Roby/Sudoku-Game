'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { readJSON, SOLO_KEY, type SavedSolo } from '@/lib/game/local';
import { isLevel, LEVEL_LABEL } from '@/lib/sudoku/bank';
import { Scramble } from './Intro';

export function ContinueLink() {
  const [saved, setSaved] = useState<SavedSolo | null>(null);
  useEffect(() => {
    const s = readJSON<SavedSolo>(SOLO_KEY);
    const touched = s && s.elapsed > 5000;
    if (s && touched && !s.won && isLevel(s.level)) setSaved(s);
  }, []);
  if (!saved) return null;
  return (
    <>
      <Link
        href={`/solo/${saved.level}?g=${saved.seed.toString(36)}`}
        className="item intro-item"
        style={{ animationDelay: '880ms' }}
      >
        <Scramble text={`Continuer · ${LEVEL_LABEL[saved.level]}`} />
      </Link>
      <span className="sep" aria-hidden />
    </>
  );
}
