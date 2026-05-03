import { renderMarkdown, renderInline, chalk } from "./src/cli/markdown.js";

console.log("=== Markdown Rendering Test ===\n");

const md = [
  "# Main Heading",
  "",
  "This is a **bold** and *italic* text with `inline code`.",
  "",
  "## Code Block",
  "",
  "```typescript",
  'const greeting: string = "Hello, World!";',
  "console.log(greeting);",
  "```",
  "",
  "## List",
  "",
  "- First item",
  "- Second item with **bold**",
  "- Third item",
  "",
  "## Numbered List",
  "",
  "1. Step one",
  "2. Step two",
  "3. Step three",
  "",
  "## Table",
  "",
  "| Feature | Status |",
  "|---------|--------|",
  "| Markdown | ✓ |",
  "| Code | ✓ |",
  "| Tables | ✓ |",
  "",
  "> This is a blockquote",
  "",
  "[Visit GitHub](https://github.com)",
  "",
  "~~Strikethrough text~~",
].join("\n");

const rendered = renderMarkdown(md);
console.log(rendered);

console.log("\n=== Chalk Colors Test ===\n");
console.log(chalk.bold.cyan("  Bold Cyan"));
console.log(chalk.bold.green("  Bold Green"));
console.log(chalk.bold.yellow("  Bold Yellow"));
console.log(chalk.bold.red("  Bold Red"));
console.log(chalk.bold.magenta("  Bold Magenta"));
console.log(chalk.dim("  Dim text"));
console.log(chalk.hex("#79c0ff")("  Custom blue"));
console.log(chalk.bgHex("#161b22").hex("#c9d1d9")("  Code block style"));
console.log(chalk.bold.green("✓ ") + chalk.green("Success"));
console.log(chalk.bold.red("✗ ") + chalk.red("Error"));
console.log(chalk.bold.yellow("⚠ ") + chalk.yellow("Warning"));
console.log(chalk.dim.cyan("  Think block content"));

console.log("\n=== Banner Test ===\n");
console.log(chalk.bold.cyan("  ╔══════════════════════════════════════╗"));
console.log(chalk.bold.cyan("  ║") + chalk.bold.white("  pi-agent-clone v0.1.0                ") + chalk.bold.cyan("║"));
console.log(chalk.bold.cyan("  ╚══════════════════════════════════════╝"));
console.log();
console.log("  " + chalk.cyan("Model:") + "   " + chalk.bold("GLM-5.1") + " " + chalk.dim("(glm)"));
console.log("  " + chalk.cyan("Tools:") + "   " + chalk.dim("terminal, read_file, write_file"));
console.log("  " + chalk.cyan("Memory:") + "  " + chalk.magenta("3 entries") + " " + chalk.dim("~/.pi-agent/MEMORY.md"));
console.log();
console.log("  " + chalk.dim("Type your message · /help for commands · Ctrl+C to exit"));

console.log("\n=== Inline Markdown ===\n");
console.log(renderInline("Use `chalk` for **colorful** output with *style*!"));
