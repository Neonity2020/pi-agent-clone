'use client';

import { useState } from 'react';

const copy = {
  en: {
    badge: 'Open-source · Multi-provider · CLI-first',
    title: 'Build faster with a modern autonomous coding agent.',
    subtitle:
      'Neonity Agent helps you plan, edit, run, and ship code with support for leading LLM providers.',
    ctaPrimary: 'Get Started',
    ctaSecondary: 'Explore Features',
    footer: 'Crafted with Next.js 16.',
    langLabel: '中文',
  },
  zh: {
    badge: '开源 · 多模型提供商 · CLI 优先',
    title: '使用现代化自治编程代理，更快完成开发。',
    subtitle: 'Neonity Agent 帮助你完成规划、编辑、运行与交付代码，并支持主流大模型提供商。',
    ctaPrimary: '立即开始',
    ctaSecondary: '探索功能',
    footer: '基于 Next.js 16 构建。',
    langLabel: 'English',
  },
} as const;

const features = {
  en: {
    heading: 'Everything you need in one minimal stack',
    items: [
      { title: 'Unified Model Providers', description: 'Use OpenAI, Anthropic, Gemini, GLM, and MiniMax through one streamlined architecture.' },
      { title: 'Agentic Workflow', description: 'From context collection to patch generation, the loop is designed for real software tasks.' },
      { title: 'Built-in Tooling', description: 'Read/write files, inspect git, run terminal commands, and manage project changes safely.' },
      { title: 'TypeScript Core', description: 'A concise TS codebase that is easy to understand, extend, and productionize.' },
    ],
  },
  zh: {
    heading: '你需要的能力，尽在这一套精简栈中',
    items: [
      { title: '统一模型提供商接入', description: '通过一套简洁架构统一调用 OpenAI、Anthropic、Gemini、GLM 与 MiniMax。' },
      { title: '代理式工作流', description: '从上下文收集到补丁生成，整条循环专为真实软件开发任务设计。' },
      { title: '内置工具链', description: '可安全地读写文件、查看 Git 状态、执行终端命令并管理项目变更。' },
      { title: 'TypeScript 核心实现', description: '代码库精炼清晰，易于理解、扩展并落地到生产环境。' },
    ],
  },
};

export default function HomePage() {
  const [lang, setLang] = useState<'en' | 'zh'>('en');
  const c = copy[lang];
  const f = features[lang];

  return (
    <main className="container">
      <header className="topbar">
        <span className="brand">Neonity Agent</span>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <button className="repo-link" onClick={() => setLang(lang === 'en' ? 'zh' : 'en')}>
            {c.langLabel}
          </button>
          <a
            href="https://github.com/neonity2020/neonity-agent"
            className="repo-link"
            target="_blank"
            rel="noopener noreferrer"
          >
            GitHub
          </a>
        </div>
      </header>

      <section className="hero">
        <p className="badge">{c.badge}</p>
        <h1>{c.title}</h1>
        <p className="subtitle">{c.subtitle}</p>
        <div className="actions">
          <a
            href="https://github.com/neonity2020/neonity-agent"
            className="btn btn-primary"
            target="_blank"
            rel="noopener noreferrer"
          >
            {c.ctaPrimary}
          </a>
          <a href="#features" className="btn btn-ghost">
            {c.ctaSecondary}
          </a>
        </div>
      </section>

      <section id="features" className="features">
        <h2>{f.heading}</h2>
        <div className="feature-grid">
          {f.items.map((item) => (
            <article key={item.title} className="card">
              <h3>{item.title}</h3>
              <p>{item.description}</p>
            </article>
          ))}
        </div>
      </section>

      <footer className="footer">
        <p>© {new Date().getFullYear()} Neonity Agent. {c.footer}</p>
      </footer>
    </main>
  );
}
