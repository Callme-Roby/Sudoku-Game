import Link from 'next/link';

export default function NotFound() {
  return (
    <main className="screen home">
      <p style={{ margin: 0 }}>page introuvable</p>
      <Link href="/" className="item">
        menu
      </Link>
    </main>
  );
}
