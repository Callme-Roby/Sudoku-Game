'use client';

import { useEffect, useRef, useState } from 'react';

const GLYPHS = '123456789';
const DURATION = 340; // ms per label

const introDone = () =>
  document.documentElement.dataset.intro === 'done' ||
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * A label that decodes itself: random digits that settle letter by letter.
 * The parent carries the CSS reveal (`.intro-item`); we read its clock through
 * the Web Animations API so the scramble starts exactly when the label shows.
 */
export function Scramble({ text }: { text: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const [out, setOut] = useState(text);

  useEffect(() => {
    if (introDone()) return;
    const host = ref.current?.parentElement;
    const anim = host?.getAnimations?.()[0];
    const delay = anim ? Number(anim.effect?.getTiming().delay ?? 0) - Number(anim.currentTime ?? 0) : 0;
    if (delay < -DURATION) return; // revealed long ago (slow hydration): leave it alone
    const chars = Array.from(text);
    // each letter settles at its own moment, roughly left to right
    const settle = chars.map((_, i) => ((i + Math.random() * 1.5) / (chars.length + 1.5)) * DURATION);
    let raf = 0;
    let last = 0;
    const scrambled = () =>
      chars.map((c) => (c === ' ' || c === '·' ? c : GLYPHS[Math.floor(Math.random() * 9)])).join('');
    setOut(scrambled()); // still hidden: no flash of the final text
    const t0 = performance.now() + Math.max(0, delay);
    const tick = (now: number) => {
      const t = now - t0;
      if (t >= DURATION) {
        setOut(text);
        return;
      }
      if (now - last > 45) {
        last = now;
        setOut(
          chars
            .map((c, i) => (c === ' ' || c === '·' || t >= settle[i] ? c : GLYPHS[Math.floor(Math.random() * 9)]))
            .join(''),
        );
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      setOut(text); // never leave a label scrambled
    };
  }, [text]);

  return (
    <span ref={ref}>
      <span className="sr-only">{text}</span>
      <span aria-hidden>{out}</span>
    </span>
  );
}

/**
 * Marks the intro as played once it has run, or as soon as the player picks
 * something: coming back to the menu does not replay it.
 */
export function IntroDone() {
  useEffect(() => {
    const done = () => {
      document.documentElement.dataset.intro = 'done';
    };
    const t = window.setTimeout(done, 2400);
    document.addEventListener('click', done, { capture: true, once: true });
    return () => {
      window.clearTimeout(t);
      document.removeEventListener('click', done, { capture: true });
    };
  }, []);
  return null;
}
