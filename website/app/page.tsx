import { FeatureGrid } from '@/components/feature-grid';
import { Hero } from '@/components/hero';

export default function HomePage() {
  return (
    <main className="container">
      <header className="topbar">
        <span className="brand">Pi-Agent Clone</span>
        <a href="https://github.com/neonity2020/pi-agent-clone" className="repo-link" target="_blank" rel="noopener noreferrer">
          GitHub
        </a>
      </header>
      <Hero />
      <FeatureGrid />
      <footer className="footer">
        <p>© {new Date().getFullYear()} Pi-Agent Clone. Crafted with Next.js 16.</p>
      </footer>
    </main>
  );
}
