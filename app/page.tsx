import { HomeMenu } from '@/components/HomeMenu';
import { IntroDone } from '@/components/Intro';
import { Logo } from '@/components/Logo';

export default function Home() {
  return (
    <div className="home-page">
      <main className="screen home">
        <Logo />
        <HomeMenu />
      </main>
      <footer>
        <a className="credit intro-credit" href="https://callmeroby.com" target="_blank" rel="noopener">
          Un jeu de Studio Roby <span className="dim">·</span> <span className="url">callmeroby.com</span>
        </a>
      </footer>
      <IntroDone />
    </div>
  );
}
