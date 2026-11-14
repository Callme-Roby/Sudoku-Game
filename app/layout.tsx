import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'sudoku',
  description: 'Sudoku, tout simplement. Seul, en duel ou en battle royale.',
  applicationName: 'sudoku',
  appleWebApp: { capable: true, title: 'sudoku', statusBarStyle: 'default' },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#efede7' },
    { media: '(prefers-color-scheme: dark)', color: '#1b1b1a' },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <head>
        <link
          rel="preload"
          href="/fonts/dotgothic16-latin-400-normal.woff2"
          as="font"
          type="font/woff2"
          crossOrigin="anonymous"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
