const features = [
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
];

export function FeatureGrid() {
  return (
    <section id="features" className="features">
      <h2>Everything you need in one minimal stack</h2>
      <div className="feature-grid">
        {features.map((item) => (
          <article key={item.title} className="card">
            <h3>{item.title}</h3>
            <p>{item.description}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
