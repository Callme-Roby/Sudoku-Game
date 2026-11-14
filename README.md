# sudoku

Un sudoku classique et épuré : une grille, du blanc cassé, un noir doux, des gris pour les repères,
et un trait de pixel art très fin.

- **Solo** : facile · moyen · difficile · extrême (9 × 9) et 6 × 6 (très facile)
- **Défier un ami** : un lien d'invitation, la même grille, le plus rapide gagne
- **Battle royale** : jusqu'à 10 joueurs sur la même grille, progression des adversaires en direct
- Notes (crayon), annuler, effacer, conflits signalés par une trame, chiffres terminés estompés
- Clavier : `1`–`9`, flèches, `⌫`, `N` (notes), `Ctrl/⌘ + Z`
- Partie solo sauvegardée automatiquement (recharger la page reprend la grille), record par niveau
- Installable comme web app (manifest + icônes), thème sombre automatique

## Lancer en local

```bash
npm install
npm run dev        # http://localhost:3000
npm test           # moteur sudoku + logique de jeu
npm run typecheck
```

En local, les parties multijoueur sont gardées en mémoire : tout marche, sans rien configurer.
Pour tester à plusieurs, ouvre le lien d'invitation dans une autre fenêtre (ou un autre appareil du réseau).

## Déployer sur Vercel

1. Importer le dépôt sur [vercel.com/new](https://vercel.com/new) (Next.js est détecté tout seul).
2. **Pour le multijoueur** : dans le projet Vercel, onglet *Storage* → *Upstash for Redis* (Marketplace) →
   créer une base (l'offre gratuite suffit) et la connecter au projet.
   Les variables `KV_REST_API_URL` et `KV_REST_API_TOKEN` sont ajoutées automatiquement
   (`UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` marchent aussi).
3. Redéployer. Le solo n'a besoin de rien : il tourne entièrement dans le navigateur.

> Sans Redis, les fonctions serverless de Vercel ne partagent pas leur mémoire : les salles multijoueur
> ne seraient pas fiables en production.

## Comment ça marche

**Grilles.** `scripts/generate-bank.ts` génère des grilles à solution unique et les note avec un solveur
« humain » (`lib/sudoku/grader.ts`) selon la technique la plus difficile nécessaire :

| niveau    | techniques requises                                         | indices |
| --------- | ----------------------------------------------------------- | ------- |
| 6 × 6     | singletons                                                  | 18–20   |
| facile    | singletons                                                  | 38–41   |
| moyen     | singletons, dont beaucoup de singletons cachés              | 30–32   |
| difficile | paires, triplets, candidats bloqués                         | ~27     |
| extrême   | X-wing, swordfish, XY-wing… ou au-delà                      | ~24     |

À l'exécution, une graine (`seed`) choisit une grille de la banque et la mélange (chiffres, lignes,
colonnes, bandes, transposition) : la difficulté est conservée et les variantes sont pratiquement
infinies. En multijoueur, tout le monde reçoit la même graine, donc la même grille.

**Multijoueur.** Les clients interrogent `/api/rooms/[code]` toutes les 1,5 s (pas de WebSocket :
ça marche tel quel sur Vercel). Le serveur garde l'horloge (compte à rebours, chrono), recalcule la
progression de chaque joueur et vérifie la grille finale : les temps affichés sont fiables.
Chaque joueur n'écrit que son propre champ Redis, donc pas de conflit d'écriture.

## Direction artistique

- Couleurs : jetons CSS dans `app/globals.css` (`--paper #efede7`, `--ink #1f1e1c`, gris `--zone`,
  `--same`, `--sel`) — et leur inverse en mode sombre.
- Logo « Sudoku » : la police script *Great Vibes* squelettisée en trait d'un pixel puis rééchantillonnée
  sur une grille fine (`scripts/make-logo.mjs`, pour changer de police ou de taille).
- Chiffres, notes et icônes dessinés à la main pixel par pixel (`lib/pixel/glyphs.ts`), rendus en SVG
  net (`shape-rendering: crispEdges`) ; un « pixel » = `--u` (2 px CSS).
- Texte : [DotGothic16](https://fonts.google.com/specimen/DotGothic16) (licence OFL), trait d'un pixel.
- Icônes de l'app : `python3 scripts/make-icons.py`.
- Animation d'entrée (au chargement, désactivée si « réduire les animations ») : le logo s'écrit pixel par
  pixel en suivant le tracé de la plume (`lib/pixel/trace.ts`), les intitulés se décodent depuis des chiffres
  aléatoires (`components/Intro.tsx`), puis le trait et le bandeau apparaissent ; en jeu, les chiffres de
  départ arrivent en balayage diagonal.

## Structure

```
app/                  pages (accueil, /solo/[niveau], /defi, /royale, /r/[code]) et API /api/rooms
components/           grille, pavé, jeu solo, salle multijoueur, rendu pixel
lib/sudoku/           géométrie, solveur, noteur, générateur, banque de grilles (puzzles.json)
lib/game/             état du jeu (reducer), stockage local, client API
lib/server/           salles multijoueur + stockage (Upstash Redis / mémoire)
lib/pixel/            bitmaps : logo, chiffres, icônes
scripts/              génération des grilles, du logo et des icônes
tests/                tests Vitest
```

## Et ensuite

- **Android / iOS** : envelopper la web app avec [Capacitor](https://capacitorjs.com) (le jeu solo est
  déjà 100 % côté client ; le multijoueur pointe vers l'API déployée).
- **Steam / ordinateur** : même code dans [Tauri](https://tauri.app) ou Electron.
- Mode hors ligne (service worker), partage d'une grille solo par lien (`/solo/moyen?g=…` existe déjà).
