type HeroProps = {
  lang: 'en' | 'zh';
};

const copy = {
  en: {
    badge: 'Open-source · Multi-provider · CLI-first',
    title: 'Build faster with a modern autonomous coding agent.',
    subtitle:
      'Pi-Agent Clone helps you plan, edit, run, and ship code with support for leading LLM providers.',
    ctaPrimary: 'Get Started',
    ctaSecondary: 'Explore Features',
  },
  zh: {
    badge: '开源 · 多模型提供商 · CLI 优先',
    title: '使用现代化自治编程代理，更快完成开发。',
    subtitle: 'Pi-Agent Clone 帮助你完成规划、编辑、运行与交付代码，并支持主流大模型提供商。',
    ctaPrimary: '立即开始',
    ctaSecondary: '探索功能',
  },
} as const;

export function Hero({ lang }: HeroProps) {
  const content = copy[lang];

  return (
    <section className="hero">
      <p className="badge">{content.badge}</p>
      <h1>{content.title}</h1>
      <p className="subtitle">{content.subtitle}</p>
      <div className="actions">
        <a href="https://github.com/neonity2020/pi-agent-clone" className="btn btn-primary" target="_blank" rel="noopener noreferrer">
          {content.ctaPrimary}
        </a>
        <a href="#features" className="btn btn-ghost">
          {content.ctaSecondary}
        </a>
      </div>
    </section>
  );
}
