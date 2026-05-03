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
import { ANSI, registerCommand, type CommandContext } from "./registry.js";
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

    console.log(`  ${ANSI.red}Unknown: ${sub}${ANSI.reset}`);
    console.log(`  ${ANSI.dim}Use /model for interactive selection, /model list to see all.${ANSI.reset}`);
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
    console.log(`  ${ANSI.dim}Cancelled.${ANSI.reset}`);
    return;
  }

  const providerName = selectedProvider.value as ProviderName;
  const models = grouped[providerName] ?? [];

  if (models.length === 0) {
    console.log(`  ${ANSI.dim}No models available for ${selectedProvider.label}.${ANSI.reset}`);
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
    console.log(`  ${ANSI.dim}Cancelled.${ANSI.reset}`);
    return;
  }

  const model = MODELS[selectedModel.value];
  if (model) switchModel(ctx, model);
}

// ---- Switch model ----------------------------------------------------------

function switchModel(ctx: CommandContext, model: Model): void {
  ctx.config.model = model;
  console.log(
    `  ${ANSI.green}${ANSI.bold}✓${ANSI.reset} Switched to ` +
    `${ANSI.bold}${model.name}${ANSI.reset} ` +
    `${ANSI.dim}(${model.provider} | ${formatTokens(model.contextWindow)} ctx | ` +
    `${formatTokens(model.maxTokens)} out)${ANSI.reset}`,
  );
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
  console.log(`  ${ANSI.bold}Available Models${ANSI.reset}`);
  console.log(`  ${ANSI.dim}──────────────────────────────────────────────────────────────────${ANSI.reset}`);

  for (const [provider, models] of Object.entries(grouped)) {
    const info = PROVIDER_INFO[provider as ProviderName];
    const label = info?.label || provider;
    const color = info?.color || "";

    console.log(`\n  ${color}${ANSI.bold}${label}${ANSI.reset}`);

    for (const m of models) {
      const marker = m.id === currentId
        ? `  ${ANSI.green}◀ current${ANSI.reset}`
        : "";
      const cost = m.cost
        ? `  ${ANSI.dim}${formatCost(m.cost)}/1M${ANSI.reset}`
        : "";
      console.log(
        `    ${ANSI.green}${m.id.padEnd(28)}${ANSI.reset}` +
        `${m.name.padEnd(18)}` +
        `${ANSI.dim}${formatTokens(m.contextWindow).padStart(7)} ctx${ANSI.reset}` +
        `${cost}${marker}`,
      );
    }
  }

  console.log("");
  console.log(`  ${ANSI.dim}Switch with: /model <id> or /model for interactive selection${ANSI.reset}`);
  console.log("");
}

// ---- Show provider's models (non-interactive) ------------------------------

async function showProviderModels(provider: string, ctx: CommandContext): Promise<void> {
  const grouped = getModelsByProvider();
  const models = grouped[provider as ProviderName];
  if (!models) {
    console.log(`  ${ANSI.red}No models for provider: ${provider}${ANSI.reset}`);
    return;
  }

  const info = PROVIDER_INFO[provider as ProviderName];
  console.log("");
  console.log(`  ${(info?.color || "")}${ANSI.bold}${info?.label || provider}${ANSI.reset} models:`);
  for (const m of models) {
    const marker = m.id === ctx.config.model.id ? `  ${ANSI.green}◀${ANSI.reset}` : "";
    console.log(`    ${ANSI.green}${m.id}${ANSI.reset} — ${m.name}${marker}`);
  }
  console.log(`  ${ANSI.dim}Switch with: /model <id>${ANSI.reset}`);
  console.log("");
}

// ---- Show providers (non-interactive) --------------------------------------

async function showProviders(ctx: CommandContext): Promise<void> {
  console.log("");
  console.log(`  ${ANSI.bold}Providers${ANSI.reset}`);
  console.log(`  ${ANSI.dim}──────────────────────────────────${ANSI.reset}`);

  for (const [provider, info] of Object.entries(PROVIDER_INFO)) {
    const hasKey = !!process.env[info.envKey];
    const keyIcon = hasKey ? `${ANSI.green}✓${ANSI.reset}` : `${ANSI.red}✗${ANSI.reset}`;
    const models = getModelsByProvider()[provider as ProviderName] ?? [];
    console.log(
      `  ${info.color}${ANSI.bold}${info.label.padEnd(12)}${ANSI.reset} ` +
      `${keyIcon} ${ANSI.dim}${info.envKey}${ANSI.reset} ` +
      `${ANSI.dim}(${models.length} models)${ANSI.reset}`,
    );
  }

  console.log("");
}

// ---- Register --------------------------------------------------------------

registerCommand({
  name: "model",
  aliases: [],
  description: "Interactive model selection (↑↓ navigate, Enter select)",
  usage: "[list|providers|<model-id>]",
  category: "config",
  execute: handleModel,
});
