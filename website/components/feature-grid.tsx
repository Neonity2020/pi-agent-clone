type FeatureGridProps = {
  lang: 'en' | 'zh';
};

const copy = {
  en: {
    heading: 'Everything you need in one minimal stack',
    features: [
      {
        title: 'Unified Model Providers',
        description: 'Use OpenAI, Anthropic, Gemini, GLM, and MiniMax through one streamlined architecture.',
      },
      {
        title: 'Agentic Workflow',
        description: 'From context collection to patch generation, the loop is designed for real software tasks.',
      },
      {
        title: 'Built-in Tooling',
        description: 'Read/write files, inspect git, run terminal commands, and manage project changes safely.',
      },
      {
        title: 'TypeScript Core',
        description: 'A concise TS codebase that is easy to understand, extend, and productionize.',
      },
    ],
  },
  zh: {
    heading: '你需要的能力，尽在这一套精简栈中',
    features: [
      {
        title: '统一模型提供商接入',
        description: '通过一套简洁架构统一调用 OpenAI、Anthropic、Gemini、GLM 与 MiniMax。',
      },
      {
        title: '代理式工作流',
        description: '从上下文收集到补丁生成，整条循环专为真实软件开发任务设计。',
      },
      {
        title: '内置工具链',
        description: '可安全地读写文件、查看 Git 状态、执行终端命令并管理项目变更。',
      },
      {
        title: 'TypeScript 核心实现',
        description: '代码库精炼清晰，易于理解、扩展并落地到生产环境。',
      },
    ],
  },
} as const;

export function FeatureGrid({ lang }: FeatureGridProps) {
  const content = copy[lang];

  return (
    <section id="features" className="features">
      <h2>{content.heading}</h2>
      <div className="feature-grid">
        {content.features.map((item) => (
          <article key={item.title} className="card">
            <h3>{item.title}</h3>
            <p>{item.description}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
