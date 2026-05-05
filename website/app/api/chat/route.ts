// POST /api/chat — SSE streaming endpoint
// Creates/reuses an AgentLoop per session, streams AgentEvents back as SSE

import { NextRequest } from "next/server";
import { createWebAgent } from "@/lib/agent-bridge";
import { formatSSE, SSE_HEADERS } from "@/lib/sse";

// Session store: Map<sessionId, { agent, lastAccess }>
const sessions = new Map<string, { agent: ReturnType<typeof createWebAgent>; lastAccess: number }>();
const SESSION_TTL = 30 * 60 * 1000; // 30 minutes

// Cleanup expired sessions periodically
setInterval(() => {
  const now = Date.now();
  for (const [id, session] of sessions) {
    if (now - session.lastAccess > SESSION_TTL) {
      sessions.delete(id);
    }
  }
}, 60_000);

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  if (!body || typeof body.message !== "string" || !body.message.trim()) {
    return new Response(JSON.stringify({ error: "message is required" }), { status: 400 });
  }

  const message: string = body.message.trim();
  const modelId: string = body.model || "glm-4.7";
  const maxIterations: number = Number(body.maxIterations) || 20;
  const sessionId: string = body.sessionId || crypto.randomUUID();

  // Get or create agent
  let entry = sessions.get(sessionId);
  if (!entry) {
    try {
      const agent = createWebAgent(modelId, maxIterations);
      entry = { agent, lastAccess: Date.now() };
      sessions.set(sessionId, entry);
    } catch (err) {
      return new Response(
        JSON.stringify({ error: err instanceof Error ? err.message : "Failed to create agent" }),
        { status: 400 },
      );
    }
  } else {
    entry.lastAccess = Date.now();
  }

  const agent = entry.agent;

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();

      // Send session info
      controller.enqueue(encoder.encode(formatSSE({ type: "session", sessionId })));

      try {
        const result = await agent.run(message, (event: any) => {
          if (event.type === "error") {
            console.error("[agent error]", event.error?.message);
          }
          controller.enqueue(encoder.encode(formatSSE(event)));
        });
        console.log("[agent done]", result.stopReason, "iterations:", result.iterations);
      } catch (err) {
        console.error("[agent catch]", err);
        controller.enqueue(encoder.encode(formatSSE({
          type: "error",
          error: err instanceof Error ? err.message : String(err),
        })));
      }

      controller.close();
    },

    cancel() {
      agent.abort();
    },
  });

  // Abort handling
  request.signal.addEventListener("abort", () => {
    agent.abort();
  });

  return new Response(stream, { headers: SSE_HEADERS });
}
