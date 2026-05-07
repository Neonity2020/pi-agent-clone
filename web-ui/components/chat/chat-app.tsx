"use client";

import { useCallback, useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { useChatHistory } from "../../lib/use-chat-history";
import { ChatSidebar } from "./chat-sidebar";
import { ChatContainer } from "./chat-container";
import { ArtifactSidebar } from "./artifact-sidebar";
import type { ChatMessage } from "./message-item";

export function ChatApp() {
  const searchParams = useSearchParams();
  const isTestMode = searchParams.get("test") === "true";

  const {
    sessions,
    currentSessionId,
    setCurrentSessionId,
    createSession,
    updateSession,
    deleteSession,
    isLoaded,
  } = useChatHistory();

  const handleSessionUpdate = useCallback((messages: ChatMessage[]) => {
    if (currentSessionId) {
      updateSession(currentSessionId, { messages });
    }
  }, [currentSessionId, updateSession]);

  const handleSessionIdChange = useCallback((backendSessionId: string) => {
    if (currentSessionId) {
      updateSession(currentSessionId, { backendSessionId });
    }
  }, [currentSessionId, updateSession]);

  if (!isLoaded) {
    return <div className="chat-app-layout"><div style={{padding: '2rem'}}>Loading...</div></div>;
  }

  const currentSession = sessions.find((s) => s.id === currentSessionId) || null;

  return (
    <div className="chat-app-layout">
      <ChatSidebar
        sessions={sessions}
        currentSessionId={currentSessionId}
        onSelect={setCurrentSessionId}
        onDelete={deleteSession}
        onNew={createSession}
      />
      <main className="chat-page">
        <header className="chat-header">
          <a href="/" className="brand">Neonity Agent</a>
          {isTestMode && <span className="badge">Test Mode</span>}
          <span className="badge">Web Chat</span>
        </header>
        {currentSession || isTestMode ? (
          <ChatContainer
            key={isTestMode ? "test" : currentSessionId}
            initialMessages={isTestMode ? [] : (currentSession?.messages || [])}
            initialSessionId={currentSession?.backendSessionId || ""}
            onSessionUpdate={handleSessionUpdate}
            onSessionIdChange={handleSessionIdChange}
            isTestMode={isTestMode}
          />
        ) : (
          <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--muted)" }}>
            Select or create a chat to get started
          </div>
        )}
      </main>
      <ArtifactSidebar messages={currentSession?.messages || []} />
    </div>
  );
}