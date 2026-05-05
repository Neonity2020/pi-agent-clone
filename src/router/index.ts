// ============================================================================
// Cost Router — FrugalGPT-style intelligent model routing
//
// Architecture:
//   User query → classify() via cheap model (~50 tokens) → route to cheap/expensive
//
// Routing strategies:
//   pre-classify   — Cheap model classifies complexity, route accordingly (default)
//   always-cheap   — Always use cheap model (baseline for comparison)
//   always-expensive — Always use expensive model (baseline for comparison)
//
// Stats tracked:
//   - Total queries, escalation count, tokens saved, estimated cost
// ============================================================================

import type { Model, StreamEvent } from "../types.js";
import { getTransport } from "../provider/registry.js";

// ---- Types -----------------------------------------------------------------

export interface RouterConfig {
  /** Cheap model for simple queries + classification */
  cheapModel: Model;
  /** Expensive model for complex queries */
  expensiveModel: Model;
  /** Complexity threshold (1-5). Score >= threshold → escalate. Default: 4 */
  threshold?: number;
  /** Routing strategy. Default: "pre-classify" */
  strategy?: RouterStrategy;
}

export type RouterStrategy = "pre-classify" | "always-cheap" | "always-expensive";

export interface RouteDecision {
  /** Which model was selected */
  model: Model;
  /** Complexity score from classifier (1-5). -1 if not classified */
  score: number;
  /** Whether query was escalated to expensive model */
  escalated: boolean;
  /** Classification reasoning (raw classifier output) */
  reasoning: string;
  /** Time spent classifying (ms) */
  classifyTimeMs: number;
}

export interface RouterStats {
  totalQueries: number;
  cheapQueries: number;
  expensiveQueries: number;
  escalationRate: number;       // percentage
  totalClassifyTokens: number;  // tokens spent on classification
  estimatedTokensSaved: number; // output tokens that went to cheap instead of expensive
  history: RouteDecision[];     // last N decisions
}

// ---- Classification prompt -------------------------------------------------

const CLASSIFY_SYSTEM = `Rate this query's complexity 1-5. Output ONLY the number.

1=greeting/definition 2=simple task 3=basic coding 4=multi-file/debugging 5=system design/novel problem

Do NOT reason. Do NOT explain. Output exactly one digit.`;

// ---- CostRouter class ------------------------------------------------------

export class CostRouter {
  private readonly cheapModel: Model;
  private readonly expensiveModel: Model;
  private readonly threshold: number;
  private strategy: RouterStrategy;

  // Stats
  private totalQueries = 0;
  private cheapQueries = 0;
  private expensiveQueries = 0;
  private totalClassifyTokens = 0;
  private estimatedTokensSaved = 0;
  private readonly history: RouteDecision[] = [];
  private readonly maxHistory = 100;

  constructor(config: RouterConfig) {
    this.cheapModel = config.cheapModel;
    this.expensiveModel = config.expensiveModel;
    this.threshold = config.threshold ?? 4;
    this.strategy = config.strategy ?? "pre-classify";
  }

  /** Classify query complexity using cheap model. Returns 1-5 score. */
  async classify(query: string): Promise<{ score: number; raw: string; tokens: number }> {
    const transport = getTransport(this.cheapModel.provider);
    const truncatedQuery = query.length > 500 ? query.slice(0, 500) + "..." : query;

    const stream = transport.stream({
      model: this.cheapModel,
      messages: [{ role: "user" as const, content: `User query: "${truncatedQuery}"` }],
      systemPrompt: CLASSIFY_SYSTEM,
      maxTokens: 512,
      temperature: 0,
    });

    let raw = "";
    let tokens = 0;

    for await (const event of stream) {
      if (event.type === "text_delta") {
        raw += event.text;
      }
      if (event.type === "usage" && event.usage) {
        tokens = event.usage.inputTokens + event.usage.outputTokens;
      }
    }

    // Parse score from response — handle various formats
    const score = this.parseScore(raw);
    return { score, raw, tokens };
  }

  /** Route a query to the appropriate model. */
  async route(query: string): Promise<RouteDecision> {
    const startTime = Date.now();
    this.totalQueries++;

    let decision: RouteDecision;

    switch (this.strategy) {
      case "always-cheap":
        decision = {
          model: this.cheapModel,
          score: -1,
          escalated: false,
          reasoning: "strategy=always-cheap",
          classifyTimeMs: 0,
        };
        this.cheapQueries++;
        break;

      case "always-expensive":
        decision = {
          model: this.expensiveModel,
          score: -1,
          escalated: true,
          reasoning: "strategy=always-expensive",
          classifyTimeMs: 0,
        };
        this.expensiveQueries++;
        break;

      case "pre-classify":
      default: {
        const result = await this.classify(query);
        this.totalClassifyTokens += result.tokens;
        const classifyTimeMs = Date.now() - startTime;

        const escalated = result.score >= this.threshold;
        const model = escalated ? this.expensiveModel : this.cheapModel;

        if (escalated) {
          this.expensiveQueries++;
        } else {
          this.cheapQueries++;
          // Estimate tokens saved: we assume ~500 output tokens per query that went cheap
          // (would have cost more on expensive model)
          this.estimatedTokensSaved += 500;
        }

        decision = {
          model,
          score: result.score,
          escalated,
          reasoning: `classifier="${result.raw.trim().slice(0, 100)}"`,
          classifyTimeMs,
        };
        break;
      }
    }

    // Track history
    this.history.push(decision);
    if (this.history.length > this.maxHistory) {
      this.history.shift();
    }

    return decision;
  }

  /** Get current routing statistics. */
  getStats(): RouterStats {
    return {
      totalQueries: this.totalQueries,
      cheapQueries: this.cheapQueries,
      expensiveQueries: this.expensiveQueries,
      escalationRate: this.totalQueries > 0
        ? Math.round((this.expensiveQueries / this.totalQueries) * 100)
        : 0,
      totalClassifyTokens: this.totalClassifyTokens,
      estimatedTokensSaved: this.estimatedTokensSaved,
      history: [...this.history],
    };
  }

  /** Get/set routing strategy. */
  getStrategy(): RouterStrategy {
    return this.strategy;
  }

  setStrategy(strategy: RouterStrategy): void {
    this.strategy = strategy;
  }

  /** Get/set complexity threshold. */
  getThreshold(): number {
    return this.threshold;
  }

  /** Get cheap model. */
  getCheapModel(): Model {
    return this.cheapModel;
  }

  /** Get expensive model. */
  getExpensiveModel(): Model {
    return this.expensiveModel;
  }

  /** Reset stats. */
  resetStats(): void {
    this.totalQueries = 0;
    this.cheapQueries = 0;
    this.expensiveQueries = 0;
    this.totalClassifyTokens = 0;
    this.estimatedTokensSaved = 0;
    this.history.length = 0;
  }

  // ---- Internal helpers ----------------------------------------------------

  /**
   * Parse complexity score from classifier output.
   * Handles reasoning models that wrap output in <think.../think> tags.
   */
  private parseScore(raw: string): number {
    const trimmed = raw.trim();

    // ---- Case 1: closed think block — extract score after </think/ > ----
    const thinkEndMatch = trimmed.match(/<\/think\s*>\s*([\s\S]*)$/i);
    if (thinkEndMatch) {
      const afterThink = thinkEndMatch[1].trim();
      const direct = parseInt(afterThink, 10);
      if (direct >= 1 && direct <= 5) return direct;
      const match = afterThink.match(/\b([1-5])\b/);
      if (match) return parseInt(match[1], 10);
    }

    // ---- Case 2: unclosed think block — scan from END to find final score ----
    // Reasoning models often conclude with "X" or "score: X" at the very end.
    // Scan backwards to avoid matching "1-5" scale references early in the text.
    const lines = trimmed.split("\n");
    for (let i = lines.length - 1; i >= 0; i--) {
      const line = lines[i].trim();
      // Match patterns like "5", "Score: 4", "Rating: 3", "complexity: 2"
      const scored = line.match(/(?:score|rating|complexity|level)[:\s]*(\d)/i);
      if (scored) {
        const v = parseInt(scored[1], 10);
        if (v >= 1 && v <= 5) return v;
      }
      // A line that is JUST a digit 1-5
      const solo = line.match(/^([1-5])$/);
      if (solo) return parseInt(solo[1], 10);
    }

    // ---- Case 3: direct number at start (non-reasoning models) ----
    const direct = parseInt(trimmed, 10);
    if (direct >= 1 && direct <= 5) return direct;

    // ---- Default: route to cheap (benefit of doubt) ----
    return 3;
  }
}
