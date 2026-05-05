import { FeatureGrid } from '@/components/feature-grid';
import { Hero } from '@/components/hero';

type HomePageProps = {
  searchParams?: Promise<{
    lang?: string;
  }>;
};

const copy = {
  en: {
    footer: 'Crafted with Next.js 16.',
    langLabel: '中文',
  },
  zh: {
    footer: '基于 Next.js 16 构建。',
    langLabel: 'English',
  },
} as const;

export default async function HomePage({ searchParams }: HomePageProps) {
  const params = await searchParams;
  const lang = params?.lang === 'zh' ? 'zh' : 'en';
  const content = copy[lang];

  return (
    <main className="container">
      <header className="topbar">
        <span className="brand">Neonity Agent</span>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <a href={lang === 'zh' ? '/' : '/?lang=zh'} className="repo-link">
            {content.langLabel}
          </a>
          <a href="https://github.com/neonity2020/neonity-agent" className="repo-link" target="_blank" rel="noopener noreferrer">
            GitHub
          </a>
        </div>
      </header>
      <Hero lang={lang} />
      <FeatureGrid lang={lang} />
      <footer className="footer">
        <p>
          © {new Date().getFullYear()} Neonity Agent. {content.footer}
        </p>
      </footer>
    </main>
  );
}
