import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'sudoku',
    short_name: 'sudoku',
    description: 'Sudoku, tout simplement. Seul, en duel ou en battle royale.',
    lang: 'fr',
    start_url: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#efede7',
    theme_color: '#efede7',
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
