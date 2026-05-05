// ============================================================================
// /model command — interactive two-stage model selection
//
// Flow:
//   /model              → Interactive picker: select provider → select model
//   /model list         → Show all models grouped by provider (non-interactive)
//   /model providers    → Show providers with API key status (non-interactive)
//   /model <id>         → Quick switch by model ID (fuzzy match)
//   /model <provider>   → Show provider's models (non-interactive)
//
// Interactive picker:
//   ↑/↓ or j/k          Navigate
//   Enter               Select
//   Ctrl+C / Esc        Cancel / go back
// ============================================================================

import type { Model, ProviderName } from "../../types.js";
import {
  MODELS,
  PROVIDER_INFO,
  getModelsByProvider,
  resolveModel,
  formatTokens,
  formatCost,
} from "../models.js";
import { c, registerCommand, type CommandContext } from "./registry.js";
import { pick, type PickerItem } from "./picker.js";

// ---- Subcommand dispatch ---------------------------------------------------

type SubHandler = (ctx: CommandContext) => Promise<void>;
const subcommands = new Map<string, SubHandler>();
subcommands.set("list", showList);
subcommands.set("providers", showProviders);

// ---- Main handler ----------------------------------------------------------

async function handleModel(ctx: CommandContext): Promise<void> {
  const sub = ctx.args[0];

  // /model list | /model providers
  if (sub && subcommands.has(sub)) {
    await subcommands.get(sub)!(ctx);
    return;
  }

  // /model <id> — quick switch by fuzzy model ID
  if (sub) {
    const model = resolveModel(sub);
    if (model) {
      switchModel(ctx, model);
      return;
    }

    // Try provider name
    const provider = matchProvider(sub);
    if (provider) {
      await showProviderModels(provider, ctx);
      return;
    }

    console.log(`  ${c.error(`Unknown: ${sub}`)}`);
    console.log(`  ${c.dim("Use /model for interactive selection, /model list to see all.")}`);
    return;
  }

  // /model (no args) — interactive two-stage picker
  await interactivePicker(ctx);
}

// ---- Interactive two-stage picker ------------------------------------------

async function interactivePicker(ctx: CommandContext): Promise<void> {
  const grouped = getModelsByProvider();
  const currentProvider = ctx.config.model.provider;
  const currentModelId = ctx.config.model.id;

  // ── Stage 1: Select provider ────────────────────────────────────────────
  const providerItems: PickerItem[] = Object.entries(PROVIDER_INFO).map(
    ([provider, info]) => {
      const models = grouped[provider as ProviderName] ?? [];
      const hasKey = !!process.env[info.envKey];
      const isCurrent = provider === currentProvider;

      return {
        label: info.label,
        value: provider,
        detail: `${models.length} model${models.length !== 1 ? "s" : ""}`,
        badge: [
          hasKey ? "✓" : "✗",
          isCurrent ? "◀ current" : undefined,
        ].filter(Boolean).join(" "),
      };
    },
  );

  const selectedProvider = await pick(providerItems, {
    title: "── Select Provider ──",
    footer: "↑↓ navigate · Enter select · Ctrl+C cancel",
  }, ctx.rl);

  if (!selectedProvider) {
    console.log(`  ${c.dim("Cancelled.")}`);
    return;
  }

  const providerName = selectedProvider.value as ProviderName;
  const models = grouped[providerName] ?? [];

  if (models.length === 0) {
    console.log(`  ${c.dim(`No models available for ${selectedProvider.label}.`)}`);
    return;
  }

  // Auto-select if only one model
  if (models.length === 1) {
    switchModel(ctx, models[0]);
    return;
  }

  // ── Stage 2: Select model ──────────────────────────────────────────────
  const modelItems: PickerItem[] = models.map((m) => {
    const parts: string[] = [];
    parts.push(`${formatTokens(m.contextWindow)} ctx`);
    parts.push(`${formatTokens(m.maxTokens)} out`);
    if (m.cost) parts.push(formatCost(m.cost));

    return {
      label: m.name,
      value: m.id,
      detail: parts.join(" · "),
      badge: m.id === currentModelId ? "◀ current" : undefined,
    };
  });

  const info = PROVIDER_INFO[providerName];
  const selectedModel = await pick(modelItems, {
    title: `── Select Model (${info?.label || providerName}) ──`,
    footer: "↑↓ navigate · Enter select · Ctrl+C cancel",
  }, ctx.rl);

  if (!selectedModel) {
    console.log(`  ${c.dim("Cancelled.")}`);
    return;
  }

  const model = MODELS[selectedModel.value];
  if (!model) return;

  switchModel(ctx, model);

  // ── Stage 3: Set max iterations ──────────────────────────────────────────
  await setMaxIterations(ctx);
}

// ---- Switch model ----------------------------------------------------------

function switchModel(ctx: CommandContext, model: Model): void {
  ctx.config.model = model;
  console.log(
    `  ${c.success("✓")} Switched to ` +
    `${c.bold(model.name)} ` +
    c.dim(`(${model.provider} | ${formatTokens(model.contextWindow)} ctx | ` +
    `${formatTokens(model.maxTokens)} out)`),
  );
}

// ---- Set max iterations (Stage 3 of interactive picker) ---------------------

async function setMaxIterations(ctx: CommandContext): Promise<void> {
  const current = ctx.config.maxIterations;
  const presets: PickerItem[] = [
    { label: "10 turns",  value: "10",  detail: "quick tasks",     badge: current === 10 ? "◀ current" : undefined },
    { label: "20 turns",  value: "20",  detail: "default",         badge: current === 20 ? "◀ current" : undefined },
    { label: "30 turns",  value: "30",  detail: "extended",        badge: current === 30 ? "◀ current" : undefined },
    { label: "50 turns",  value: "50",  detail: "long sessions",   badge: current === 50 ? "◀ current" : undefined },
  ];

  const selected = await pick(presets, {
    title: `── Max Iterations (current: ${current}) ──`,
    footer: "↑↓ navigate · Enter select · Ctrl+C keep current",
  }, ctx.rl);

  if (!selected) {
    console.log(`  ${c.dim(`Keeping ${current} iterations.`)}`);
    return;
  }

  ctx.config.maxIterations = parseInt(selected.value, 10);
  console.log(`  ${c.success("✓")} Max iterations: ${c.bold(selected.value)}`);
}

// ---- Match provider name (fuzzy) -------------------------------------------

function matchProvider(input: string): ProviderName | null {
  const lower = input.toLowerCase();
  for (const [provider, info] of Object.entries(PROVIDER_INFO)) {
    if (
      provider === lower ||
      info.label.toLowerCase().includes(lower)
    ) {
      return provider as ProviderName;
    }
  }
  return null;
}

// ---- Show all models (non-interactive) -------------------------------------

async function showList(ctx: CommandContext): Promise<void> {
  const grouped = getModelsByProvider();
  const currentId = ctx.config.model.id;

  console.log("");
  console.log(`  ${c.bold.cyan("Available Models")}`);
  console.log(`  ${c.dim("─".repeat(60))}`);

  for (const [provider, models] of Object.entries(grouped)) {
    const info = PROVIDER_INFO[provider as ProviderName];
    const label = info?.label || provider;
    // Provider color from hex (map provider to chalk color)
    const providerColor = getProviderColor(provider);

    console.log(`\n  ${c.bold(providerColor(label))}`);

    for (const m of models) {
      const marker = m.id === currentId
        ? `  ${c.success("◀ current")}`
        : "";
      const cost = m.cost
        ? `  ${c.dim(`${formatCost(m.cost)}/1M`)}`
        : "";
      console.log(
        `    ${c.cyan(m.id.padEnd(28))}` +
        `${m.name.padEnd(18)}` +
        `${c.dim(`${formatTokens(m.contextWindow).padStart(7)} ctx`)}` +
        `${cost}${marker}`,
      );
    }
  }

  console.log("");
  console.log(`  ${c.dim("Switch with: /model <id> or /model for interactive selection")}`);
  console.log("");
}

// ---- Show provider's models (non-interactive) ------------------------------

async function showProviderModels(provider: string, ctx: CommandContext): Promise<void> {
  const grouped = getModelsByProvider();
  const models = grouped[provider as ProviderName];
  if (!models) {
    console.log(`  ${c.error(`No models for provider: ${provider}`)}`);
    return;
  }

  const info = PROVIDER_INFO[provider as ProviderName];
  const providerColor = getProviderColor(provider);
  console.log("");
  console.log(`  ${c.bold(providerColor(info?.label || provider))} ${c.dim("models:")}`);
  for (const m of models) {
    const marker = m.id === ctx.config.model.id ? `  ${c.success("◀")}` : "";
    console.log(`    ${c.cyan(m.id)} ${c.dim("─")} ${m.name}${marker}`);
  }
  console.log(`  ${c.dim("Switch with: /model <id>")}`);
  console.log("");
}

// ---- Show providers (non-interactive) --------------------------------------

async function showProviders(ctx: CommandContext): Promise<void> {
  console.log("");
  console.log(`  ${c.bold.cyan("Providers")}`);
  console.log(`  ${c.dim("─".repeat(40))}`);

  for (const [provider, info] of Object.entries(PROVIDER_INFO)) {
    const hasKey = !!process.env[info.envKey];
    const keyIcon = hasKey ? c.success("✓") : c.error("✗");
    const models = getModelsByProvider()[provider as ProviderName] ?? [];
    const providerColor = getProviderColor(provider);
    console.log(
      `  ${c.bold(providerColor(info.label.padEnd(12)))} ` +
      `${keyIcon} ${c.dim(info.envKey)} ` +
      `${c.dim(`(${models.length} models)`)}`,
    );
  }

  console.log("");
}

// ---- Provider color helper -------------------------------------------------

function getProviderColor(provider: string): (text: string) => string {
  const colors: Record<string, (text: string) => string> = {
    openai:    chalk.green,
    anthropic: chalk.magenta,
    gemini:    chalk.blue,
    glm:       chalk.cyan,
    minimax:   chalk.yellow,
  };
  return colors[provider] || chalk.white;
}

import { chalk } from "../markdown.js";

// ---- Register --------------------------------------------------------------

registerCommand({
  name: "model",
  aliases: [],
  description: "Interactive model selection (↑↓ navigate, Enter select)",
  usage: "[list|providers|<model-id>]",
  category: "config",
  execute: handleModel,
});
