import Link from 'next/link';

export default function NotFound() {
  return (
    <main className="screen home">
      <p style={{ margin: 0 }}>Page introuvable</p>
      <Link href="/" className="item">
        Menu
      </Link>
    </main>
  );
}
